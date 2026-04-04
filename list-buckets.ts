import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Buckets:", data.map(b => b.name));
  }
}

main();
