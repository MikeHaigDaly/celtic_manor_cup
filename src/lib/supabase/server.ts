import { createClient } from "@supabase/supabase-js";

/**
 * Anon-key server client (RLS on) — for reads. Every `read_all` RLS policy
 * in this app is `using (true)` (no per-session scoping — see the migrations),
 * so this doesn't need `@supabase/ssr`'s cookie plumbing. Using a plain
 * client avoids pulling in `next/headers` `cookies()`, which would otherwise
 * force every page that reads data into fully dynamic (uncached) rendering.
 */
export const supabaseServer = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );

