-- 3.5.0: free app (no paid plan) + chat safety (block / report).
-- 1) No paid plan: remove the free-plan task cap.
drop trigger if exists task_free_plan_limit on public.tasks;

-- 2) Blocks
create table if not exists public.user_blocks(
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id), check(blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "Read own blocks" on public.user_blocks;
create policy "Read own blocks" on public.user_blocks for select to authenticated using(auth.uid() = blocker_id);

-- A blocked pair can never become pending/accepted friends (either direction).
create or replace function public.prevent_blocked_friendship() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('pending','accepted') and exists(
    select 1 from public.user_blocks b
    where (b.blocker_id = new.requester_id and b.blocked_id = new.addressee_id)
       or (b.blocker_id = new.addressee_id and b.blocked_id = new.requester_id)) then
    raise exception 'blocked';
  end if;
  return new;
end; $$;
drop trigger if exists friendships_block_guard on public.friendships;
create trigger friendships_block_guard before insert or update on public.friendships
  for each row execute function public.prevent_blocked_friendship();

create or replace function public.block_user(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then return false; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  -- ending the friendship also stops chat (messages policy requires an accepted friendship)
  update public.friendships set status = 'declined'
   where (requester_id = auth.uid() and addressee_id = p_user) or (requester_id = p_user and addressee_id = auth.uid());
  return true;
end; $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- 3) Reports (operator reviews them in the Supabase dashboard). Keeps the last 20 messages as evidence.
create table if not exists public.user_reports(
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_id uuid references auth.users(id) on delete set null,
  reason text not null check(length(reason) between 2 and 500),
  evidence jsonb, status text not null default 'open' check(status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now()
);
alter table public.user_reports enable row level security; -- no client policies: insert only through report_user()

create or replace function public.report_user(p_user uuid, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare v_ev jsonb;
begin
  if auth.uid() is null or p_user is null or p_user = auth.uid() then return 'invalid'; end if;
  if length(trim(coalesce(p_reason,''))) < 2 then return 'invalid'; end if;
  if (select count(*) from public.user_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then return 'rate_limited'; end if;
  select coalesce(jsonb_agg(x order by x.created_at), '[]'::jsonb) into v_ev from (
    select sender_id, recipient_id, body, created_at from public.messages
     where (sender_id = auth.uid() and recipient_id = p_user) or (sender_id = p_user and recipient_id = auth.uid())
     order by created_at desc limit 20) x;
  insert into public.user_reports(reporter_id, reported_id, reason, evidence) values (auth.uid(), p_user, left(trim(p_reason), 500), v_ev);
  return 'ok';
end; $$;
revoke all on function public.report_user(uuid,text) from public, anon;
grant execute on function public.report_user(uuid,text) to authenticated;
