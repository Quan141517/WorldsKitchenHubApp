alter table profiles add column if not exists roblox_display_name text;
alter table profiles add column if not exists roblox_role_name text;
alter table profiles add column if not exists roblox_role_rank integer;
alter table profiles add column if not exists roblox_avatar_url text;

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
