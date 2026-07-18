-- Migration 3: AI-suggested chapter per idea
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

alter table ideas add column if not exists suggested_chapter_id uuid references chapters(id) on delete set null;
