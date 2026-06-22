create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null unique,
  discord_username text,
  highest_role_id text,
  discord_role_ids text[] not null default '{}',
  roblox_user_id text,
  roblox_username text,
  roblox_display_name text,
  roblox_role_name text,
  roblox_role_rank integer,
  avatar_url text,
  roblox_avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists hub_state (
  id text primary key default 'main',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hub_state enable row level security;

create table if not exists role_snapshots (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  highest_role_id text not null,
  discord_role_ids text[] not null default '{}',
  synced_at timestamptz not null default now()
);

create table if not exists categories (
  id text primary key,
  name text not null,
  sort_order integer not null default 0,
  allowed_role_ids text[] not null default '{}',
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quick_links (
  id text primary key,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists category_links (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resources (
  id text primary key,
  category_id text not null references categories(id) on delete cascade,
  title text not null,
  content_html text not null default '',
  status text not null default 'draft',
  pinned boolean not null default false,
  needs_review boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists announcements (
  id text primary key,
  title text not null,
  content_html text not null,
  status text not null default 'draft',
  allowed_role_ids text[] not null default '{}',
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_by uuid references profiles(id),
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists weekly_assignments (
  id text primary key,
  team_role_id text not null,
  sessions_required integer not null default 0,
  minutes_required integer not null default 0,
  shifts_required integer not null default 0,
  starts_at date not null,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists activity_log_slots (
  id text primary key,
  slot_date date not null,
  slot_type text not null,
  slot_time text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id text primary key,
  slot_id text not null references activity_log_slots(id) on delete cascade,
  server_number integer not null default 1,
  logger_profile_id uuid not null references profiles(id),
  notes text,
  credited_minutes integer not null default 0,
  deleted_at timestamptz,
  deleted_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_log_members (
  id text primary key,
  activity_log_id text not null references activity_logs(id) on delete cascade,
  role_label text not null,
  roblox_username text not null,
  roblox_user_id text,
  profile_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists activity_minute_entries (
  id text primary key,
  roblox_user_id text not null,
  roblox_username text not null,
  minutes integer not null default 0,
  place_id text,
  universe_id text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id text primary key,
  actor_profile_id uuid references profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists admin_levels (
  id text primary key,
  name text not null unique,
  permissions text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_grants (
  id text primary key,
  discord_user_id text not null,
  admin_level_id text not null references admin_levels(id) on delete cascade,
  granted_by uuid references profiles(id),
  revoked_at timestamptz,
  revoked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique(discord_user_id, admin_level_id)
);
