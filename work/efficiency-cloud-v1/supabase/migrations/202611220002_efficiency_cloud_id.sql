-- Independent Efficiency Cloud account identifier. Authentication remains managed by Supabase Auth.
-- Each user receives a stable, non-secret public support/login identifier.
alter table public.profiles
  add column if not exists cloud_id text;

update public.profiles
set cloud_id = 'EC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where cloud_id is null;

alter table public.profiles
  alter column cloud_id set default ('EC-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  alter column cloud_id set not null;

create unique index if not exists profiles_cloud_id_unique
  on public.profiles(cloud_id);

-- Ensure accounts created after this migration receive a cloud_id via the column default.
-- Keep the existing profile trigger and its server-side ownership model intact.
