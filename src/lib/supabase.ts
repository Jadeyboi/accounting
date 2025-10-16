import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Basic validation to catch misconfigured environments early
if (
  !supabaseUrl ||
  !supabaseUrl.startsWith("https://") ||
  !supabaseUrl.includes(".supabase.co")
) {
  throw new Error(
    "Missing or invalid VITE_SUPABASE_URL. Set it to your project URL, e.g. https://YOUR_PROJECT.supabase.co"
  );
}

if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
  throw new Error(
    "Missing or invalid VITE_SUPABASE_ANON_KEY. Copy the anon public key from your Supabase project settings."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional: convenience accessor to bind to a specific schema (default: public)
export const db = (schema: string = "public") => supabase.schema(schema);
