import "server-only";
import { tmpdir } from "node:os";
import { createWorker } from "tesseract.js";

// sprint-24-tasks.md решение 13 — a picture's text, read on our server by
// tesseract.js: free, no keys, and the picture never leaves (решение 11).
// The languages the users write and their tickets print. Their trained
// data comes from tesseract.js's CDN the first time a function instance
// needs it and is cached in /tmp (the only writable place on Vercel).
const LANGUAGES = ["eng", "spa", "rus", "ukr"];

export async function readPictureText(picture: Buffer): Promise<string> {
  const worker = await createWorker(LANGUAGES, 1, { cachePath: tmpdir() });
  try {
    const { data } = await worker.recognize(picture);
    return data.text;
  } finally {
    await worker.terminate();
  }
}
