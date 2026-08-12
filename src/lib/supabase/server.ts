import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Anon-key server client (RLS on) — for reads.
 */
export const supabaseServer = () => {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() { /* not used */ },
        remove() { /* not used */ },
      },
    },
  );
};

