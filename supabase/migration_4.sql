-- Migration 4: idea grouping (organize multiple pending ideas together)
-- and file analysis (upload + free-form AI instruction on a file)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create table if not exists idea_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  idea_texts text[] not null,
  reasoning text,
  created_at timestamptz not null default now()
);

alter table idea_groups enable row level security;

create table if not exists file_analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  filename text not null,
  storage_path text not null,
  instruction text not null,
  result text,
  created_at timestamptz not null default now()
);

alter table file_analyses enable row level security;
