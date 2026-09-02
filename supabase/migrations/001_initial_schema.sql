-- Own-ed Supabase schema
-- Run this in Supabase SQL editor to set up persistence

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create table if not exists assumptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  data jsonb not null,
  is_live boolean default true,
  updated_at timestamptz default now()
);

create table if not exists scenarios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  name text not null,
  data jsonb not null,
  locked boolean default false,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  name text not null,
  notes text,
  assumptions jsonb not null,
  outputs jsonb,
  created_at timestamptz default now()
);

create table if not exists decisions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists studios (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists space_images (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  board text not null,
  data jsonb not null,
  storage_path text,
  created_at timestamptz default now()
);

create table if not exists library_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies (single-user MVP — extend for multi-user)
alter table assumptions enable row level security;
alter table scenarios enable row level security;
alter table snapshots enable row level security;
alter table decisions enable row level security;
alter table studios enable row level security;
alter table space_images enable row level security;
alter table library_items enable row level security;

create policy "Users can manage own assumptions" on assumptions
  for all using (auth.uid() = user_id);

create policy "Users can manage own scenarios" on scenarios
  for all using (auth.uid() = user_id);

create policy "Users can manage own snapshots" on snapshots
  for all using (auth.uid() = user_id);

create policy "Users can manage own decisions" on decisions
  for all using (auth.uid() = user_id);

create policy "Users can manage own studios" on studios
  for all using (auth.uid() = user_id);

create policy "Users can manage own space_images" on space_images
  for all using (auth.uid() = user_id);

create policy "Users can manage own library_items" on library_items
  for all using (auth.uid() = user_id);

-- Storage bucket for moodboard images
-- Create via Supabase dashboard: bucket name "space-images", private
