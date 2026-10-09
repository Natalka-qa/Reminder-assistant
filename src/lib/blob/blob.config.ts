import "server-only";
import { env } from "@/lib/env";

// Profile photo uploads need a Vercel Blob store connected to the project
// (BLOB_READ_WRITE_TOKEN). Without one, Settings doesn't offer "Upload
// photo" and the action answers with a plain error instead of crashing.
export function isAvatarUploadEnabled(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}
