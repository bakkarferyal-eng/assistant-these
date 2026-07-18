-- Migration 2: page limits/style per chapter, idea feedback, daily content
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

alter table chapters add column if not exists page_limit integer;
alter table chapters add column if not exists style_note text;

alter table ideas add column if not exists feedback text;

create table if not exists daily (
  project_id uuid primary key references projects(id) on delete cascade,
  date date,
  type text,
  content text,
  created_at timestamptz not null default now()
);

alter table daily enable row level security;
