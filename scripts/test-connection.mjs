import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.from("projects").select("*");

if (error) {
  console.error("Connexion échouée:", error.message);
  process.exit(1);
}

console.log("Connexion OK. Lignes dans 'projects':", data.length);
