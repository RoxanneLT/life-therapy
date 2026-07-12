/**
 * Bunny.net integration for Life-Therapy
 *
 * Storage Zone  → PDFs, worksheets, downloadable files
 * Bunny Stream  → Course video hosting
 */

import { requireEnv, envOr } from "@/lib/env";
// ─── Environment ──────────────────────────────────────────────────────────────
// Read at USE, fail-closed. requireEnv throws a named error the moment a Bunny var
// is missing — never bakes the literal string "undefined" into a URL, which is what
// the module-level `!` reads did (and what the two app/api/bunny routes copied
// without even the guard). getStorageCreds()/getStreamCreds() are the single
// readers; nothing else reads the raw vars.

// CDN hostname is NEXT_PUBLIC (inlined into the client bundle), so it stays a
// literal member-access — it can't go through a function.
const CDN_HOSTNAME = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME || "";

function getStorageCreds(): { zone: string; key: string; hostname: string } {
  const region = envOr("BUNNY_STORAGE_REGION", "de"); // "de" = Frankfurt
  return {
    zone: requireEnv("BUNNY_STORAGE_ZONE_NAME"),
    key: requireEnv("BUNNY_STORAGE_API_KEY"),
    hostname: STORAGE_HOSTNAMES[region] || STORAGE_HOSTNAMES.de,
  };
}

function getStreamCreds(): { libraryId: string; key: string } {
  return {
    libraryId: requireEnv("BUNNY_STREAM_LIBRARY_ID"),
    key: requireEnv("BUNNY_STREAM_API_KEY"),
  };
}

// Storage zone regional hostnames
const STORAGE_HOSTNAMES: Record<string, string> = {
  de: "storage.bunnycdn.com",    // Frankfurt (default)
  ny: "ny.storage.bunnycdn.com", // New York
  la: "la.storage.bunnycdn.com", // Los Angeles
  sg: "sg.storage.bunnycdn.com", // Singapore
  syd: "syd.storage.bunnycdn.com", // Sydney
};

// ─── Storage Zone: File Upload ─────────────────────────────────────────────

/**
 * Upload a file Buffer to Bunny Storage Zone.
 * Returns the public CDN URL on success.
 *
 * @param buffer   File contents
 * @param path     Destination path within the storage zone, e.g. "courses/module-1/worksheet.pdf"
 * @param mimeType e.g. "application/pdf"
 */
export async function uploadToStorage(
  buffer: Buffer,
  path: string,
  mimeType: string
): Promise<string> {
  const { zone, key, hostname } = getStorageCreds();
  const url = `https://${hostname}/${zone}/${path}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: key,
      "Content-Type": mimeType,
    },
    body: buffer as unknown as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny Storage upload failed (${res.status}): ${text}`);
  }

  return getCdnUrl(path);
}

/**
 * Delete a file from Bunny Storage Zone by its CDN URL or path.
 */
export async function deleteFromStorage(pathOrUrl: string): Promise<void> {
  const { zone, key, hostname } = getStorageCreds();
  const path = pathOrUrl.startsWith("http")
    ? pathOrUrl.replace(`https://${CDN_HOSTNAME}/`, "")
    : pathOrUrl;

  const url = `https://${hostname}/${zone}/${path}`;
  await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: key },
  });
}

/**
 * Build a public CDN URL from a storage path.
 */
export function getCdnUrl(path: string): string {
  return `https://${CDN_HOSTNAME}/${path}`;
}

// ─── Bunny Stream: Video ───────────────────────────────────────────────────

export interface BunnyVideo {
  guid: string;
  title: string;
  status: number; // 0=queued, 3=encoding, 4=finished, 5=error
  length: number; // seconds
  views: number;
  storageSize: number;
  thumbnailFileName: string;
}

/**
 * Create a new video entry in Bunny Stream (returns a GUID for direct upload).
 */
export async function createStreamVideo(title: string): Promise<{ guid: string }> {
  const { libraryId, key } = getStreamCreds();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny Stream create failed (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Upload video bytes to an existing Bunny Stream video GUID.
 * For large files use the TUS resumable upload endpoint instead.
 */
export async function uploadStreamVideo(
  guid: string,
  buffer: Buffer
): Promise<void> {
  const { libraryId, key } = getStreamCreds();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    {
      method: "PUT",
      headers: {
        AccessKey: key,
        "Content-Type": "video/*",
      },
      body: buffer as unknown as BodyInit,
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bunny Stream upload failed (${res.status}): ${text}`);
  }
}

/**
 * Fetch metadata for a Bunny Stream video.
 */
export async function getStreamVideo(guid: string): Promise<BunnyVideo> {
  const { libraryId, key } = getStreamCreds();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    { headers: { AccessKey: key } }
  );

  if (!res.ok) throw new Error(`Bunny Stream fetch failed (${res.status})`);
  return res.json();
}

/**
 * Delete a video from Bunny Stream.
 */
export async function deleteStreamVideo(guid: string): Promise<void> {
  const { libraryId, key } = getStreamCreds();

  await fetch(
    `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    {
      method: "DELETE",
      headers: { AccessKey: key },
    }
  );
}

/**
 * Build the embed iframe URL for a Bunny Stream video.
 * This is what gets stored in `Lecture.videoUrl`.
 */
export function getStreamEmbedUrl(guid: string): string {
  return `https://iframe.mediadelivery.net/embed/${requireEnv("BUNNY_STREAM_LIBRARY_ID")}/${guid}?autoplay=false&responsive=true`;
}

/**
 * Direct-upload target for a storage-zone path: the URL and key the browser needs
 * to PUT a file straight to Bunny. Guarded — a missing env var throws here rather
 * than returning the string "undefined" as the zone in a client-facing URL, which
 * is what the /api/bunny/upload route did before it called this.
 */
export function getStorageUploadTarget(path: string): {
  uploadUrl: string;
  apiKey: string;
  cdnUrl: string;
} {
  const { zone, key, hostname } = getStorageCreds();
  return {
    uploadUrl: `https://${hostname}/${zone}/${path}`,
    apiKey: key,
    cdnUrl: getCdnUrl(path),
  };
}

/** Direct-upload target for a freshly-created Bunny Stream video. Guarded. */
export function getStreamUploadTarget(guid: string): { uploadUrl: string; apiKey: string } {
  const { libraryId, key } = getStreamCreds();
  return {
    uploadUrl: `https://video.bunnycdn.com/library/${libraryId}/videos/${guid}`,
    apiKey: key,
  };
}

/**
 * Extract the Bunny Stream GUID from an embed URL (for deletion/updates).
 */
export function extractStreamGuid(embedUrl: string): string | null {
  const match = embedUrl.match(/embed\/\d+\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the folder path for a lecture's worksheet inside the storage zone.
 * e.g. "courses/foundations-of-self-confidence/module-1/worksheet.pdf"
 */
export function worksheetStoragePath(
  courseSlug: string,
  moduleSlug: string,
  filename: string
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
  return `courses/${courseSlug}/${moduleSlug}/${safe}`;
}
