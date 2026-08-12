import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — server-side only. NEVER import from client components.
 */
export const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error("Missing Supabase server env vars");
  return createClient(url, key, { auth: { persistSession: false } });
};

