-- 3.6.0: "what did I do" timeline, memory editing, realtime cloud sync.

-- 1) Task completion time (so completed work can be recalled by day).
alter table public.tasks add column if not exists completed_at timestamptz;
update public.tasks set completed_at = coalesce(updated_at, created_at) where is_done and completed_at is null;
create or replace function public.set_task_completed_at() returns trigger language plpgsql as $$
begin
  if new.is_done and (tg_op = 'INSERT' or coalesce(old.is_done,false) = false) then new.completed_at := now();
  elsif not new.is_done then new.completed_at := null; end if;
  return new;
end; $$;
drop trigger if exists task_completed_at on public.tasks;
create trigger task_completed_at before insert or update of is_done on public.tasks for each row execute function public.set_task_completed_at();
create index if not exists tasks_user_completed_idx on public.tasks(user_id, completed_at desc) where is_done;

-- 2) Memory edit timestamp.
alter table public.memories add column if not exists updated_at timestamptz not null default now();
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
drop trigger if exists memories_touch on public.memories;
create trigger memories_touch before update on public.memories for each row execute function public.touch_updated_at();

-- 3) Timeline: completed tasks + memories by local day. SECURITY INVOKER, so RLS limits it to the caller's own rows.
create or replace function public.my_timeline(p_from date, p_to date, p_tz text default 'UTC')
returns table(kind text, id text, title text, body text, category text, day date, at timestamptz)
language sql stable set search_path = '' as $$
  select * from (
    select 'task'::text, t.id::text, t.name, null::text, t.category,
           (t.completed_at at time zone p_tz)::date as day, t.completed_at
      from public.tasks t where t.user_id = auth.uid() and t.is_done and t.completed_at is not null
    union all
    select 'memory', m.id::text, m.title, m.body, null,
           coalesce(m.memory_date, (m.created_at at time zone p_tz)::date), m.created_at
      from public.memories m where m.user_id = auth.uid()
  ) x
  where x.day between p_from and p_to
  order by x.day desc, x.at desc limit 500;
$$;
grant execute on function public.my_timeline(date,date,text) to authenticated;

-- 4) "On this day" in earlier years.
create or replace function public.on_this_day(p_month int, p_day int, p_year int, p_tz text default 'UTC')
returns table(kind text, id text, title text, body text, category text, day date, at timestamptz)
language sql stable set search_path = '' as $$
  select * from public.my_timeline('2000-01-01', make_date(p_year, 1, 1) - 1, p_tz) x
  where extract(month from x.day) = p_month and extract(day from x.day) = p_day
  order by x.day desc, x.at desc limit 50;
$$;
grant execute on function public.on_this_day(int,int,int,text) to authenticated;

-- 5) Realtime sync across devices (RLS still applies to change events).
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.tasks; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.memories; exception when duplicate_object then null; end;
  end if;
end $$;
