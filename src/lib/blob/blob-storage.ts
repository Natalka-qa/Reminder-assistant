import "server-only";
import { del, put } from "@vercel/blob";
import { env } from "@/lib/env";

// The app's only use of Vercel Blob: public profile photos. The token is
// passed explicitly (rather than left to the SDK's process.env lookup) so
// that "configured" means the same thing here as in isAvatarUploadEnabled().

export async function uploadPublicBlob(
  pathname: string,
  body: Blob,
  contentType: string,
): Promise<string> {
  const blob = await put(pathname, body, {
    access: "public",
    contentType,
    token: env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

/**
 * Best effort: an orphaned photo in the store costs a few KB, while a
 * failed clean-up shouldn't undo a change the user already sees saved.
 */
export async function deleteBlobQuietly(url: string): Promise<void> {
  try {
    await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    console.error("Couldn't delete blob", url, error);
  }
}
