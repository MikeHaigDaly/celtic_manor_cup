"use server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function setPlayerPhoto(playerSlug: string, formData: FormData) {
  const file = formData.get("photo");
  if (!(file instanceof File)) throw new Error("No photo provided");
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Photo must be a JPEG, PNG, WEBP, or GIF");
  if (file.size > MAX_BYTES) throw new Error("Photo must be under 5MB");

  const sb = supabaseAdmin();
  // Timestamped path (rather than overwriting a fixed one) so the new
  // photo gets a fresh URL — sidesteps CDN/browser caching of the old image.
  const path = `${playerSlug}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await sb.storage.from("player-photos").upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (uploadErr) throw uploadErr;

  const { data: pub } = sb.storage.from("player-photos").getPublicUrl(path);

  const { error: updateErr } = await sb.from("players")
    .update({ photo_url: pub.publicUrl })
    .eq("slug", playerSlug);
  if (updateErr) throw updateErr;

  revalidatePath("/players/[slug]", "page");
  revalidatePath("/");
}
