-- ============================================================
--  OUR SPACE — Supabase schema
--  Run this ONCE in the Supabase Dashboard → SQL Editor → New query → Run.
--  Safe to re-run: everything uses "if not exists" / "or replace".
-- ============================================================

-- ---------- 1. PROFILES (one row per partner) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  role       text check (role in ('a','b')),   -- a = red (him), b = pink (her)
  created_at timestamptz not null default now()
);

-- auto-create an empty profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2. PLANS (shared daily plan, by date) ----------
create table if not exists public.plans (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  for_role   text not null check (for_role in ('a','b')),  -- who the plan is FOR
  text       text not null,
  done       boolean not null default false,
  author     uuid references auth.users(id) on delete set null,  -- who wrote it
  created_at timestamptz not null default now()
);
create index if not exists plans_day_idx on public.plans(day);

-- ---------- 3. PHOTOS (metadata; file lives in storage) ----------
create table if not exists public.photos (
  id         uuid primary key default gen_random_uuid(),
  day        date not null,
  path       text not null,             -- storage path inside the 'photos' bucket
  caption    text,
  author     uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists photos_day_idx on public.photos(day);

-- ---------- 4. SONGS (metadata; file in storage OR a link) ----------
create table if not exists public.songs (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('audio','yt','link')),
  title      text,
  author_name text,                     -- artist / who added it (free text)
  path       text,                      -- storage path inside 'music' (kind=audio)
  yt         text,                      -- youtube id (kind=yt)
  src        text,                      -- url (kind=link)
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------- 5. VIDEOS (short clips in storage OR a link) ----------
create table if not exists public.videos (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('file','yt','tiktok','instagram','link')),
  title       text,
  author_name text,
  path        text,                      -- storage path inside 'videos' (kind=file)
  src         text,                      -- original url (links)
  yt          text,                      -- youtube id (kind=yt)
  thumb       text,                      -- cover image url, if any
  added_by    uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists videos_created_idx on public.videos(created_at);

-- ---------- 6. NOTES (shared notebook — both partners read & write) ----------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  text       text not null,
  author     uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists notes_created_idx on public.notes(created_at);

-- ============================================================
--  ROW LEVEL SECURITY
--  This is a private app for exactly two trusted people, so any
--  LOGGED-IN user may read/write everything. Anonymous (no session)
--  gets nothing. This is what keeps strangers out.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.plans    enable row level security;
alter table public.photos   enable row level security;
alter table public.songs    enable row level security;
alter table public.videos   enable row level security;
alter table public.notes    enable row level security;

-- profiles: everyone logged in can read; you can only create/edit your own row
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_modify" on public.profiles;
create policy "profiles_read"   on public.profiles for select to authenticated using (true);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_modify" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- plans / photos / songs: any logged-in partner has full access
drop policy if exists "plans_all"  on public.plans;
create policy "plans_all"  on public.plans  for all to authenticated using (true) with check (true);

drop policy if exists "photos_all" on public.photos;
create policy "photos_all" on public.photos for all to authenticated using (true) with check (true);

drop policy if exists "songs_all"  on public.songs;
create policy "songs_all"  on public.songs  for all to authenticated using (true) with check (true);

drop policy if exists "videos_all" on public.videos;
create policy "videos_all" on public.videos for all to authenticated using (true) with check (true);

drop policy if exists "notes_all"  on public.notes;
create policy "notes_all"  on public.notes  for all to authenticated using (true) with check (true);

-- ============================================================
--  GRANTS (needed because "auto-expose new tables" is OFF)
-- ============================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.plans    to authenticated;
grant select, insert, update, delete on public.photos   to authenticated;
grant select, insert, update, delete on public.songs    to authenticated;
grant select, insert, update, delete on public.videos   to authenticated;
grant select, insert, update, delete on public.notes    to authenticated;

-- ============================================================
--  STORAGE BUCKETS (private) + policies
-- ============================================================
insert into storage.buckets (id, name, public)
values ('photos','photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('music','music', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('videos','videos', false)
on conflict (id) do nothing;

-- any logged-in partner can read/upload/delete files in these two buckets
drop policy if exists "photos_bucket_all" on storage.objects;
create policy "photos_bucket_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'photos')
  with check (bucket_id = 'photos');

drop policy if exists "music_bucket_all" on storage.objects;
create policy "music_bucket_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'music')
  with check (bucket_id = 'music');

drop policy if exists "videos_bucket_all" on storage.objects;
create policy "videos_bucket_all" on storage.objects
  for all to authenticated
  using (bucket_id = 'videos')
  with check (bucket_id = 'videos');

-- ============================================================
--  REALTIME (live sync between the two partners)
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.plans;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.photos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.songs;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.videos;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null;
end $$;
