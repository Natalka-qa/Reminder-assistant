import { randomBytes } from "node:crypto";
import { InvalidAvatarError } from "@/features/user/user.errors";

// Profile photo — the pure parts, kept out of user.service.ts so they're
// unit-testable without a database or a Blob store (like telegram-link-code).
// The browser already shrinks the photo to a 256×256 JPEG (a few dozen KB);
// these limits are the server's own check, not the client's promise.

export const AVATAR_MAX_BYTES = 512 * 1024;

export const AVATAR_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AvatarContentType = (typeof AVATAR_CONTENT_TYPES)[number];

const EXTENSIONS: Record<AvatarContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Vercel Blob's public stores are served from
// https://<store-id>.public.blob.vercel-storage.com/...
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const AVATAR_PREFIX = "avatars/";

/**
 * The image type its first bytes say it is, or null. The browser's declared
 * type is only a claim; this is what gets stored as the Content-Type.
 */
export function sniffImageType(bytes: Uint8Array): AvatarContentType | null {
  const at = (offset: number, signature: number[]) =>
    signature.every((byte, i) => bytes[offset + i] === byte);
  if (at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }
  // "RIFF" <size> "WEBP"
  if (at(0, [0x52, 0x49, 0x46, 0x46]) && at(8, [0x57, 0x45, 0x42, 0x50])) {
    return "image/webp";
  }
  return null;
}

/**
 * Checks an uploaded photo (a FormData value — untrusted) and returns it
 * with its real type. Throws InvalidAvatarError with a message fit for a
 * toast.
 */
export async function parseAvatarFile(
  input: unknown,
): Promise<{ file: Blob; contentType: AvatarContentType }> {
  if (!(input instanceof Blob) || input.size === 0) {
    throw new InvalidAvatarError("Pick a photo to upload.");
  }
  if (!(AVATAR_CONTENT_TYPES as readonly string[]).includes(input.type)) {
    throw new InvalidAvatarError("Use a JPEG, PNG or WebP photo.");
  }
  if (input.size > AVATAR_MAX_BYTES) {
    throw new InvalidAvatarError(
      "That photo is too large — the limit is 512 KB.",
    );
  }
  const head = new Uint8Array(await input.slice(0, 12).arrayBuffer());
  const contentType = sniffImageType(head);
  if (contentType !== input.type) {
    throw new InvalidAvatarError("That file doesn't look like a photo.");
  }
  return { file: input, contentType };
}

/** Where a new photo goes: unique per upload, so caches never serve an old one. */
export function avatarPathname(
  userId: string,
  contentType: AvatarContentType,
  random = randomBytes(8).toString("hex"),
): string {
  return `${AVATAR_PREFIX}${userId}-${random}.${EXTENSIONS[contentType]}`;
}

/**
 * Whether User.image is a photo this app uploaded — the only kind it may
 * delete. Google's own avatar URLs (and anything else) are never ours.
 */
export function isOwnAvatarUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return (
    parsed.protocol === "https:" &&
    parsed.hostname.endsWith(BLOB_HOST_SUFFIX) &&
    parsed.pathname.startsWith(`/${AVATAR_PREFIX}`)
  );
}
