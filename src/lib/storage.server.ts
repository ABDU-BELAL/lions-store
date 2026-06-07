import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TTL = 60 * 60 * 24 * 7;

export async function signBucketPath(bucket: string, path: string | null | undefined): Promise<string> {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const { data } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, TTL);
  return data?.signedUrl ?? "";
}

export async function signMany<T extends { image_url?: string | null }>(bucket: string, rows: T[]): Promise<T[]> {
  return Promise.all(
    rows.map(async (r) => ({ ...r, image_url: await signBucketPath(bucket, r.image_url) })),
  );
}
