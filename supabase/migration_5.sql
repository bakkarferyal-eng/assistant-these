-- Migration 5: merge "Analyser un fichier" into Documents
-- file_analyses now links to an existing upload instead of storing its own file
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

alter table file_analyses drop column if exists filename;
alter table file_analyses drop column if exists storage_path;
alter table file_analyses add column if not exists upload_id uuid references uploads(id) on delete cascade;
