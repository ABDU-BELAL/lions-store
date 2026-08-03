import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Long-lived signed URLs (1 year) so images never "disappear" after a few days.
const TTL = 60 * 60 * 24 * 365;
// Refresh our in-memory cache well before the URL itself expires.
const CACHE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type CacheEntry = { url: string; at: number };
const cache = new Map<string, CacheEntry>();

function cached(bucket: string, path: string): string | undefined {
  const hit = cache.get(`${bucket}:${path}`);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(`${bucket}:${path}`);
    return undefined;
  }
  return hit.url;
}

function store(bucket: string, path: string, url: string) {
  if (!url) return;
  cache.set(`${bucket}:${path}`, { url, at: Date.now() });
}

/** Sign a batch of storage paths with ONE request per bucket (instead of one per image). */
export async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const missing: string[] = [];

  for (const p of paths) {
    if (!p) continue;
    if (/^https?:\/\//i.test(p)) { out.set(p, p); continue; }
    const hit = cached(bucket, p);
    if (hit) out.set(p, hit);
    else if (!missing.includes(p)) missing.push(p);
  }

  if (missing.length > 0) {
    const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrls(missing, TTL);
    if (error) console.error("[storage.signPaths]", bucket, error);
    for (const row of data ?? []) {
      const path = (row as { path?: string | null }).path ?? "";
      const url = row.signedUrl ?? "";
      if (path && url) { out.set(path, url); store(bucket, path, url); }
    }
  }

  return out;
}

export async function signBucketPath(bucket: string, path: string | null | undefined): Promise<string> {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const map = await signPaths(bucket, [path]);
  return map.get(path) ?? "";
}

export async function signMany<T extends { image_url?: string | null }>(bucket: string, rows: T[]): Promise<T[]> {
  const paths = rows.map((r) => r.image_url).filter((p): p is string => !!p);
  if (paths.length === 0) return rows;
  const map = await signPaths(bucket, paths);
  return rows.map((r) => ({ ...r, image_url: r.image_url ? map.get(r.image_url) ?? "" : "" }));
}
