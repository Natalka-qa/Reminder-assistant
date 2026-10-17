import "server-only";
import { tmpdir } from "node:os";
import { createWorker } from "tesseract.js";

// sprint-24-tasks.md решение 13 — a picture's text, read on our server by
// tesseract.js: free, no keys, and the picture never leaves (решение 11).
// The languages the users write and their tickets print. Their trained
// data comes from tesseract.js's CDN the first time a function instance
// needs it and is cached in /tmp (the only writable place on Vercel).
const LANGUAGES = ["eng", "spa", "rus", "ukr"];

/**
 * Within this, or it throws: a worker that dies (or a slow first start)
 * must end in "I couldn't read this picture", not a "Reading the
 * picture…" that never changes. Under the webhook's maxDuration.
 */
export const PICTURE_READ_TIMEOUT_MS = 90_000;

export async function readPictureText(picture: Buffer): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Reading the picture timed out")),
      PICTURE_READ_TIMEOUT_MS,
    );
  });
  let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
  try {
    return await Promise.race([
      (async () => {
        worker = await createWorker(LANGUAGES, 1, {
          cachePath: tmpdir(),
          errorHandler: (error: unknown) =>
            console.error("tesseract worker error:", error),
        });
        const { data } = await worker.recognize(picture);
        return data.text;
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
    await worker?.terminate().catch(() => {});
  }
}
