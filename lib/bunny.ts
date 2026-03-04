/**
 * Bunny.net integration for Life-Therapy
 *
 * Storage Zone  → PDFs, worksheets, downloadable files
 * Bunny Stream  → Course video hosting
 */

// ─── Environment ──────────────────────────────────────────────────────────────

const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME!;
const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY!;
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "de"; // "de" = Frankfurt
const CDN_HOSTNAME = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME!; // e.g. life-therapy-cdn.b-cdn.net or cdn.life-therapy.co.za

const STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;
const STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY!;

// Storage zone regional hostnames
const STORAGE_HOSTNAMES: Record<string, string> = {
  de: "storage.bunnycdn.com",    // Frankfurt (default)
  ny: "ny.storage.bunnycdn.com", // New York
  la: "la.storage.bunnycdn.com", // Los Angeles
  sg: "sg.storage.bunnycdn.com", // Singapore
  syd: "syd.storage.bunnycdn.com", // Sydney
};

function storageHostname(): string {
  return STORAGE_HOSTNAMES[STORAGE_REGION] || STORAGE_HOSTNAMES.de;
}

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
  if (!STORAGE_ZONE_NAME || !STORAGE_API_KEY) {
    throw new Error("Bunny Storage env vars are not configured (BUNNY_STORAGE_ZONE_NAME, BUNNY_STORAGE_API_KEY)");
  }

  const url = `https://${storageHostname()}/${STORAGE_ZONE_NAME}/${path}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: STORAGE_API_KEY,
      "Content-Type": mimeType,
    },
    body: buffer,
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
  const path = pathOrUrl.startsWith("http")
    ? pathOrUrl.replace(`https://${CDN_HOSTNAME}/`, "")
    : pathOrUrl;

  const url = `https://${storageHostname()}/${STORAGE_ZONE_NAME}/${path}`;
  await fetch(url, {
    method: "DELETE",
    headers: { AccessKey: STORAGE_API_KEY },
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
  assertStreamEnv();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: STREAM_API_KEY,
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
  assertStreamEnv();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos/${guid}`,
    {
      method: "PUT",
      headers: {
        AccessKey: STREAM_API_KEY,
        "Content-Type": "video/*",
      },
      body: buffer,
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
  assertStreamEnv();

  const res = await fetch(
    `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos/${guid}`,
    { headers: { AccessKey: STREAM_API_KEY } }
  );

  if (!res.ok) throw new Error(`Bunny Stream fetch failed (${res.status})`);
  return res.json();
}

/**
 * Delete a video from Bunny Stream.
 */
export async function deleteStreamVideo(guid: string): Promise<void> {
  assertStreamEnv();

  await fetch(
    `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos/${guid}`,
    {
      method: "DELETE",
      headers: { AccessKey: STREAM_API_KEY },
    }
  );
}

/**
 * Build the embed iframe URL for a Bunny Stream video.
 * This is what gets stored in `Lecture.videoUrl`.
 */
export function getStreamEmbedUrl(guid: string): string {
  return `https://iframe.mediadelivery.net/embed/${STREAM_LIBRARY_ID}/${guid}?autoplay=false&responsive=true`;
}

/**
 * Extract the Bunny Stream GUID from an embed URL (for deletion/updates).
 */
export function extractStreamGuid(embedUrl: string): string | null {
  const match = embedUrl.match(/embed\/\d+\/([a-f0-9-]+)/);
  return match ? match[1] : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assertStreamEnv() {
  if (!STREAM_LIBRARY_ID || !STREAM_API_KEY) {
    throw new Error(
      "Bunny Stream env vars are not configured (BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY)"
    );
  }
}

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
