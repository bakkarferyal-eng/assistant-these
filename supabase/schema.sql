-- Schema for assistant-these, matching the data model in spec-app-these.md
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create extension if not exists "pgcrypto";

create table projects (
  id uuid primary key default gen_random_uuid(),
  context text,
  objectif text,
  modele text,
  roadmap text,
  resultats_data jsonb,
  created_at timestamptz not null default now()
);

create table chapters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  status text not null default 'todo',
  created_at timestamptz not null default now()
);

create table points (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references chapters(id) on delete cascade,
  text text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table chapter_data (
  chapter_id uuid primary key references chapters(id) on delete cascade,
  sequence text,
  writing text,
  feedback text,
  draft_example text,
  created_at timestamptz not null default now()
);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  text text not null,
  source text,
  status text not null default 'new',
  chapter_id uuid references chapters(id) on delete set null,
  created_at timestamptz not null default now()
);

create table "references" (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  raw text,
  formatted text,
  created_at timestamptz not null default now()
);

create table quick_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  column_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table journal (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  date date not null default current_date,
  text text not null,
  created_at timestamptz not null default now()
);

create table uploads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  filename text not null,
  file_type text,
  extracted_text text,
  chapter_id uuid references chapters(id) on delete set null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: enabled with no policies yet, so tables are only
-- reachable via the server-side service_role key (used in API routes).
-- Policies get added in step 7 once Supabase Auth is wired up.
alter table projects enable row level security;
alter table chapters enable row level security;
alter table points enable row level security;
alter table chapter_data enable row level security;
alter table ideas enable row level security;
alter table "references" enable row level security;
alter table quick_notes enable row level security;
alter table journal enable row level security;
alter table uploads enable row level security;
