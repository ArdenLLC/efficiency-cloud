-- Efficiency Cloud commercial baseline. Back up the project before applying.
create extension if not exists pgcrypto;
alter table public.tasks add column if not exists priority text not null default 'normal';
alter table public.tasks add column if not exists updated_at timestamptz not null default now();
do $$ begin
 if not exists (select 1 from pg_constraint where conname='tasks_priority_check') then
  alter table public.tasks add constraint tasks_priority_check check (priority in ('normal','high','urgent')) not valid;
 end if;
end $$;
alter table public.tasks validate constraint tasks_priority_check;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text, plan text not null default 'free' check(plan in ('free','pro')),
 subscription_status text not null default 'inactive',
 current_period_end timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email) values(new.id,new.email) on conflict(id) do update set email=excluded.email; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.profiles(id,email) select id,email from auth.users on conflict(id) do nothing;

alter table public.profiles enable row level security;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using(auth.uid()=id);
-- No client write policies for profiles: only trusted server-side webhook can grant Pro.
alter table public.tasks enable row level security;
drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks" on public.tasks for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists tasks_user_created_idx on public.tasks(user_id,created_at desc);
create index if not exists tasks_user_due_idx on public.tasks(user_id,due_date);

create or replace function public.enforce_task_plan_limit() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plan text; v_count integer;
begin
 select case when plan='pro' and subscription_status in ('active','trialing') and (current_period_end is null or current_period_end > now()) then 'pro' else 'free' end into v_plan from public.profiles where id=new.user_id;
 if coalesce(v_plan,'free') <> 'pro' and new.is_done=false then
  select count(*) into v_count from public.tasks where user_id=new.user_id and is_done=false and (tg_op <> 'UPDATE' or id <> new.id);
  if v_count >= 100 then raise exception '免费版最多可保留 100 项未完成任务，升级专业版以提高额度。' using errcode='P0001'; end if;
 end if;
 return new;
end; $$;
drop trigger if exists task_free_plan_limit on public.tasks;
create trigger task_free_plan_limit before insert or update of is_done on public.tasks for each row execute function public.enforce_task_plan_limit();
