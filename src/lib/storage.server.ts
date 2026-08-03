// Images are served through our own permanent, cacheable proxy route
// (/api/public/img/<bucket>/<path>) instead of signed URLs, so links NEVER expire.

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function publicImageUrl(bucket: string, path: string | null | undefined): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `/api/public/img/${bucket}/${encodePath(path)}`;
}

/** Kept for compatibility: returns permanent proxy URLs, no signing/network needed. */
export async function signPaths(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const p of paths) {
    if (!p) continue;
    out.set(p, publicImageUrl(bucket, p));
  }
  return out;
}

export async function signBucketPath(bucket: string, path: string | null | undefined): Promise<string> {
  return publicImageUrl(bucket, path);
}

export async function signMany<T extends { image_url?: string | null }>(bucket: string, rows: T[]): Promise<T[]> {
  return rows.map((r) => ({ ...r, image_url: publicImageUrl(bucket, r.image_url) }));
}
