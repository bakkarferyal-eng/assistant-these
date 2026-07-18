import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) {
  console.error("Erreur:", listError.message);
  process.exit(1);
}

if (buckets.some((b) => b.name === "uploads")) {
  console.log("Bucket 'uploads' déjà existant.");
  process.exit(0);
}

const { error: createError } = await supabase.storage.createBucket("uploads", {
  public: false,
});

if (createError) {
  console.error("Erreur création bucket:", createError.message);
  process.exit(1);
}

console.log("Bucket 'uploads' créé (privé).");
