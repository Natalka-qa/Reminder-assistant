// Settings → profile photo, in the browser: whatever the camera roll gives
// (a 5 MB JPEG, a PNG, a HEIC where Safari can read it) becomes a 256×256
// centre-cropped JPEG of a few dozen KB before it's sent — well within the
// server's 512 KB limit and Next's 1 MB Server Action body limit.

export const AVATAR_SIZE = 256;
const QUALITY = 0.85;

export class PhotoError extends Error {}

export async function resizePhoto(file: File): Promise<File> {
  // Some pickers leave HEIC's type empty; let the decoder decide then.
  if (file.type && !file.type.startsWith("image/")) {
    throw new PhotoError("Pick an image file.");
  }

  const image = await decode(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) throw new PhotoError("That photo looks empty. Try another one.");

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("Couldn't prepare the photo. Try again.");
  // JPEG has no transparency — a transparent PNG gets white, not black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  // An <img> is drawn upright (EXIF orientation applied), so a portrait
  // phone photo doesn't come out on its side.
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITY),
  );
  if (!blob) throw new PhotoError("Couldn't prepare the photo. Try again.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}

async function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } catch {
    throw new PhotoError(
      "This browser can't open that photo. Try a JPEG or PNG.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
