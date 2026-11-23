-- Account recovery support and opt-in security email notifications.
-- Apply after the existing Efficiency Cloud ID and security-hardening migrations.
alter table public.profiles
  add column if not exists security_email_alerts boolean not null default true;

create or replace function public.set_security_email_alerts(p_enabled boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.profiles set security_email_alerts = p_enabled where id = auth.uid();
  return found;
end;
$$;
revoke all on function public.set_security_email_alerts(boolean) from public, anon;
grant execute on function public.set_security_email_alerts(boolean) to authenticated;

create table if not exists public.security_email_alert_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('new_sign_in','password_changed')),
  created_at timestamptz not null default now()
);
create index if not exists security_email_alert_events_user_event_time_idx
  on public.security_email_alert_events(user_id, event_type, created_at desc);
alter table public.security_email_alert_events enable row level security;
revoke all on table public.security_email_alert_events from anon, authenticated;

-- Service-role-only claim with an advisory lock prevents concurrent duplicate alerts.
create or replace function public.claim_security_email_alert(p_user_id uuid, p_event text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if p_event not in ('new_sign_in','password_changed') then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_event, 0));
  select count(*) into v_count from public.security_email_alert_events
   where user_id = p_user_id and event_type = p_event
     and created_at > pg_catalog.now() - interval '1 hour';
  if v_count >= 3 then return false; end if;
  insert into public.security_email_alert_events(user_id,event_type) values(p_user_id,p_event);
  return true;
end;
$$;
revoke all on function public.claim_security_email_alert(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_security_email_alert(uuid,text) to service_role;
