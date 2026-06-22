-- NeighborhoodResolve Database Setup
-- Run this in Supabase SQL Editor

-- Communities table
create table if not exists communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  access_code text unique not null,
  trial_ends_at timestamptz,
  subscription_active boolean default false,
  created_at timestamptz default now()
);

-- Cases table (anonymous - reporter_id only used for 1/month check)
create table if not exists cases (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  location text not null,
  description text not null,
  status text default 'open',
  strike_count integer default 0,
  need_volunteer boolean default false,
  reporter_id uuid references auth.users(id),
  judge_ruling text,
  resolved_at timestamptz,
  updated_at timestamptz,
  created_at timestamptz default now()
);

-- Volunteers table
create table if not exists volunteers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  address_number text,
  skills text not null,
  compensation text default 'free',
  role_interest text default 'volunteer_only',
  status text default 'available',
  free_visits_used integer default 0,
  created_at timestamptz default now()
);

-- Roles table (messenger, verifier, judge assignments)
create table if not exists roles (
  id uuid default gen_random_uuid() primary key,
  role text not null,
  volunteer_id uuid references volunteers(id),
  address_number text,
  term_start timestamptz,
  term_end timestamptz,
  active boolean default true,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table cases enable row level security;
alter table volunteers enable row level security;
alter table roles enable row level security;
alter table communities enable row level security;

-- RLS Policies: authenticated users can read all cases
create policy "Users can view all cases"
  on cases for select
  to authenticated
  using (true);

create policy "Users can insert cases"
  on cases for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Users can update cases"
  on cases for update
  to authenticated
  using (true);

-- Volunteers policies
create policy "Users can view volunteers"
  on volunteers for select
  to authenticated
  using (true);

create policy "Users can join volunteer pool"
  on volunteers for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Roles policies
create policy "Users can view roles"
  on roles for select
  to authenticated
  using (true);

create policy "Users can manage roles"
  on roles for insert
  to authenticated
  with check (true);
