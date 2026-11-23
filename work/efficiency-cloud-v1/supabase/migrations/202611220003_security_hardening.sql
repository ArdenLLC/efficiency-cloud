-- Security hardening for Efficiency Cloud 3.3.
-- Apply after 202611220001_memory_friends_chat.sql and 202611220002_efficiency_cloud_id.sql.
-- Review existing data and back up production before applying.

-- Profiles: authenticated users may change only their own public handle.
-- Never allow a client to change plan, subscription status, email, or cloud_id.
revoke update on table public.profiles from anon, authenticated;
grant update (handle) on table public.profiles to authenticated;

-- Replace broad friendship UPDATE policy with a narrow, server-checked RPC.
drop policy if exists "Recipient responds to requests" on public.friendships;
revoke update on table public.friendships from anon, authenticated;

create or replace function public.respond_friend_request(p_request_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_updated integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_status not in ('accepted','declined') then raise exception 'Invalid response'; end if;
  update public.friendships
     set status = p_status,
         accepted_at = case when p_status = 'accepted' then pg_catalog.now() else null end
   where id = p_request_id
     and addressee_id = auth.uid()
     and status = 'pending';
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return 'not_found_or_already_handled'; end if;
  return p_status;
end;
$$;
revoke all on function public.respond_friend_request(uuid,text) from public, anon;
grant execute on function public.respond_friend_request(uuid,text) to authenticated;

-- Harden friend requests: normalize input, prevent duplicates in either direction,
-- and cap each account at 20 new requests per rolling 24-hour period.
create or replace function public.send_friend_request(p_handle text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
  request_count integer;
  existing_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_handle is null or pg_catalog.length(pg_catalog.btrim(p_handle)) not between 3 and 24
     or pg_catalog.btrim(p_handle) !~ '^[A-Za-z0-9_]{3,24}$' then
    return 'invalid_handle';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));

  select id into target_id
    from public.profiles
   where pg_catalog.lower(handle) = pg_catalog.lower(pg_catalog.btrim(p_handle));
  if target_id is null then return 'not_found'; end if;
  if target_id = auth.uid() then return 'self'; end if;

  select status into existing_status
    from public.friendships
   where (requester_id = auth.uid() and addressee_id = target_id)
      or (requester_id = target_id and addressee_id = auth.uid())
   order by case when status = 'accepted' then 0 when status = 'pending' then 1 else 2 end
   limit 1;
  if existing_status = 'accepted' then return 'already_friends'; end if;
  if existing_status = 'pending' then return 'pending_exists'; end if;

  select pg_catalog.count(*) into request_count
    from public.friendships
   where requester_id = auth.uid()
     and created_at > pg_catalog.now() - interval '24 hours';
  if request_count >= 20 then return 'rate_limited'; end if;

  insert into public.friendships(requester_id, addressee_id, status, created_at)
  values(auth.uid(), target_id, 'pending', pg_catalog.now())
  on conflict(requester_id, addressee_id)
  do update set status='pending', created_at=pg_catalog.now(), accepted_at=null;
  return 'sent';
end;
$$;
revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;

-- Message abuse controls: non-empty trimmed content, authenticated sender identity,
-- and a rolling limit of 20 messages per account per minute.
do $$ begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
     where conname = 'messages_body_trim_check'
       and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages add constraint messages_body_trim_check
      check (pg_catalog.length(pg_catalog.btrim(body)) between 1 and 4000) not valid;
  end if;
end $$;
alter table public.messages validate constraint messages_body_trim_check;

create or replace function public.enforce_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if auth.uid() is null or new.sender_id <> auth.uid() then
    raise exception 'Invalid message sender' using errcode='42501';
  end if;
  if new.body is null or pg_catalog.length(pg_catalog.btrim(new.body)) not between 1 and 4000 then
    raise exception 'Message must contain 1 to 4000 characters';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 1));
  select pg_catalog.count(*) into v_count
    from public.messages
   where sender_id = auth.uid()
     and created_at > pg_catalog.now() - interval '1 minute';
  if v_count >= 20 then raise exception 'Message rate limit exceeded' using errcode='P0001'; end if;
  new.body := pg_catalog.btrim(new.body);
  return new;
end;
$$;
revoke all on function public.enforce_message_rate_limit() from public, anon, authenticated;
drop trigger if exists messages_rate_limit on public.messages;
create trigger messages_rate_limit
before insert on public.messages
for each row execute function public.enforce_message_rate_limit();

-- Add supporting indexes for rate-limit queries and pending request lookup.
create index if not exists friendships_requester_created_idx
  on public.friendships(requester_id, created_at desc);
create index if not exists messages_sender_created_idx
  on public.messages(sender_id, created_at desc);
