import { createClient } from "@supabase/supabase-js";

// Client-side: safe to use in browser components, limited by Row Level Security.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side only: bypasses Row Level Security. Never import this in a
// client component — the secret key would end up in the browser bundle.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
