/**
 * What an admin upload may be, per storage bucket, and the extension each type is stored under.
 *
 * The extension comes from this map and never from the caller's file name. A storage key is not a
 * filesystem path: the storage client puts it into a URL as it stands, and the URL parser reads
 * more spellings as a dot segment than a test for `..` does. So a key carrying any part of a name
 * the caller chose can reach a path the route never named (dev-standards/ledgers/LESSONS.md L-102).
 * A closed set needs no decode depth chosen: a type that is not a key here is refused, whatever it
 * decodes to. The name itself is kept as data where it is wanted (`fileName` on a product).
 */
export const UPLOAD_TYPES = {
  images: {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  },
  products: {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  },
} as const satisfies Record<string, Record<string, string>>;

export type UploadBucket = keyof typeof UPLOAD_TYPES;

export function isUploadBucket(bucket: unknown): bucket is UploadBucket {
  return typeof bucket === "string" && Object.hasOwn(UPLOAD_TYPES, bucket);
}

/** The extension a file of this type is stored under in this bucket, or null if the bucket does not take it. */
export function uploadExtension(bucket: UploadBucket, contentType: unknown): string | null {
  const types: Record<string, string> = UPLOAD_TYPES[bucket];
  return typeof contentType === "string" && Object.hasOwn(types, contentType) ? types[contentType] : null;
}

/** A fresh storage key. Nothing in it is the caller's: the extension is one `uploadExtension` returned. */
export function uploadPath(ext: string): string {
  return `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
}
