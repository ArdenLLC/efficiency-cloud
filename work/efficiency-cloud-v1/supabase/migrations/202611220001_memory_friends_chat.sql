-- Private cloud memories, friend requests and one-to-one chat.
create extension if not exists pgcrypto;
alter table public.profiles add column if not exists handle text;
create unique index if not exists profiles_handle_lower_unique on public.profiles(lower(handle)) where handle is not null;
alter table public.profiles enable row level security;
drop policy if exists "Users update own handle" on public.profiles;
create policy "Users update own handle" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);

create table if not exists public.memories(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 120), body text not null check(length(body) between 1 and 10000),
 memory_date date, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.memories enable row level security;
create policy "Users manage own memories" on public.memories for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
create index if not exists memories_user_date_idx on public.memories(user_id,memory_date desc,created_at desc);

create table if not exists public.friendships(
 id uuid primary key default gen_random_uuid(), requester_id uuid not null references auth.users(id) on delete cascade,
 addressee_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check(status in ('pending','accepted','declined')),
 created_at timestamptz not null default now(), accepted_at timestamptz,
 constraint friendships_not_self check(requester_id<>addressee_id),
 constraint friendships_pair_unique unique(requester_id,addressee_id)
);
alter table public.friendships enable row level security;
create policy "Participants read friendship" on public.friendships for select to authenticated using(auth.uid() in (requester_id,addressee_id));
create policy "Recipient responds to requests" on public.friendships for update to authenticated using(auth.uid()=addressee_id and status='pending') with check(auth.uid()=addressee_id and status in ('accepted','declined'));
create or replace function public.send_friend_request(p_handle text) returns text language plpgsql security definer set search_path=public as $$
declare target_id uuid;
begin
 select id into target_id from profiles where lower(handle)=lower(trim(p_handle));
 if target_id is null then return 'not_found'; end if;
 if target_id=auth.uid() then return 'self'; end if;
 if exists(select 1 from friendships where status='accepted' and ((requester_id=auth.uid() and addressee_id=target_id) or (requester_id=target_id and addressee_id=auth.uid()))) then return 'already_friends'; end if;
 insert into friendships(requester_id,addressee_id) values(auth.uid(),target_id) on conflict(requester_id,addressee_id) do update set status='pending';
 return 'sent';
end; $$;
revoke all on function public.send_friend_request(text) from public;
grant execute on function public.send_friend_request(text) to authenticated;
create or replace function public.my_friends() returns table(friend_id uuid, handle text) language sql security definer set search_path=public as $$
 select p.id,p.handle from friendships f join profiles p on p.id=case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end
 where f.status='accepted' and auth.uid() in (f.requester_id,f.addressee_id) order by p.handle;
$$;
revoke all on function public.my_friends() from public;
grant execute on function public.my_friends() to authenticated;

create table if not exists public.messages(
 id uuid primary key default gen_random_uuid(), sender_id uuid not null references auth.users(id) on delete cascade,
 recipient_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(length(body) between 1 and 4000), created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "Friends read their messages" on public.messages for select to authenticated using(
 auth.uid() in(sender_id,recipient_id) and exists(select 1 from friendships f where f.status='accepted' and ((f.requester_id=sender_id and f.addressee_id=recipient_id) or (f.requester_id=recipient_id and f.addressee_id=sender_id)))
);
create policy "Friends send messages" on public.messages for insert to authenticated with check(
 auth.uid()=sender_id and sender_id<>recipient_id and exists(select 1 from friendships f where f.status='accepted' and ((f.requester_id=sender_id and f.addressee_id=recipient_id) or (f.requester_id=recipient_id and f.addressee_id=sender_id)))
);
create index if not exists messages_pair_created_idx on public.messages(sender_id,recipient_id,created_at desc);
create or replace function public.pending_friend_requests() returns table(request_id uuid, requester_id uuid, handle text) language sql security definer set search_path=public as $$
 select f.id,f.requester_id,p.handle from friendships f join profiles p on p.id=f.requester_id
 where f.addressee_id=auth.uid() and f.status='pending' order by f.created_at desc;
$$;
revoke all on function public.pending_friend_requests() from public;
grant execute on function public.pending_friend_requests() to authenticated;
-- Restrict profile edits to the public handle only; never let clients change Pro entitlements.
revoke update on public.profiles from authenticated;
grant update(handle) on public.profiles to authenticated;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='profiles_handle_format_check') then
  alter table public.profiles add constraint profiles_handle_format_check check(handle is null or handle ~ '^[A-Za-z0-9_]{3,24}$') not valid;
 end if;
end $$;
alter table public.profiles validate constraint profiles_handle_format_check;
