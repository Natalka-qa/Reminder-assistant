import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_BYTES,
  avatarPathname,
  isOwnAvatarUrl,
  parseAvatarFile,
  sniffImageType,
} from "./avatar";
import { InvalidAvatarError } from "./user.errors";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
// "RIFF", a 4-byte size, "WEBP"
const WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

const file = (head: number[], type: string, size = 2048) => {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return new File([bytes], "photo", { type });
};

describe("sniffImageType", () => {
  it("recognises JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImageType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array(PNG))).toBe("image/png");
    expect(sniffImageType(new Uint8Array(WEBP))).toBe("image/webp");
  });

  it("returns null for anything else, including too few bytes", () => {
    expect(sniffImageType(new TextEncoder().encode("<html><body>"))).toBe(null);
    expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe(null); // GIF
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBe(null);
    expect(sniffImageType(new Uint8Array(WEBP.slice(0, 8)))).toBe(null);
  });
});

describe("parseAvatarFile", () => {
  it("accepts a small JPEG, PNG or WebP and returns its type", async () => {
    await expect(parseAvatarFile(file(JPEG, "image/jpeg"))).resolves.toEqual(
      expect.objectContaining({ contentType: "image/jpeg" }),
    );
    await expect(parseAvatarFile(file(PNG, "image/png"))).resolves.toEqual(
      expect.objectContaining({ contentType: "image/png" }),
    );
    await expect(parseAvatarFile(file(WEBP, "image/webp"))).resolves.toEqual(
      expect.objectContaining({ contentType: "image/webp" }),
    );
  });

  it("accepts exactly the size limit, not a byte more", async () => {
    await expect(
      parseAvatarFile(file(JPEG, "image/jpeg", AVATAR_MAX_BYTES)),
    ).resolves.toBeTruthy();
    await expect(
      parseAvatarFile(file(JPEG, "image/jpeg", AVATAR_MAX_BYTES + 1)),
    ).rejects.toThrow("That photo is too large — the limit is 512 KB.");
  });

  it("needs a file, and a non-empty one", async () => {
    for (const input of [null, undefined, "photo.jpg", 42, {}]) {
      await expect(parseAvatarFile(input)).rejects.toBeInstanceOf(
        InvalidAvatarError,
      );
    }
    await expect(
      parseAvatarFile(new File([], "photo.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow("Pick a photo to upload.");
  });

  it("rejects other declared types", async () => {
    for (const type of ["image/gif", "image/heic", "image/svg+xml", ""]) {
      await expect(parseAvatarFile(file(JPEG, type))).rejects.toThrow(
        "Use a JPEG, PNG or WebP photo.",
      );
    }
  });

  it("rejects content that isn't what it claims to be", async () => {
    await expect(
      parseAvatarFile(
        new File([new TextEncoder().encode("<script>alert(1)</script>")], "x", {
          type: "image/jpeg",
        }),
      ),
    ).rejects.toThrow("That file doesn't look like a photo.");
    await expect(parseAvatarFile(file(PNG, "image/jpeg"))).rejects.toThrow(
      "That file doesn't look like a photo.",
    );
  });
});

describe("avatarPathname", () => {
  it("puts the photo under avatars/ with the user id, a random part and the type's extension", () => {
    expect(avatarPathname("user_1", "image/jpeg", "abc")).toBe(
      "avatars/user_1-abc.jpg",
    );
    expect(avatarPathname("user_1", "image/png", "abc")).toBe(
      "avatars/user_1-abc.png",
    );
    expect(avatarPathname("user_1", "image/webp", "abc")).toBe(
      "avatars/user_1-abc.webp",
    );
  });

  it("is different on every upload", () => {
    const paths = new Set(
      Array.from({ length: 50 }, () => avatarPathname("u", "image/jpeg")),
    );
    expect(paths.size).toBe(50);
  });
});

describe("isOwnAvatarUrl", () => {
  it("is true for photos this app uploaded to Vercel Blob", () => {
    expect(
      isOwnAvatarUrl(
        "https://abc123xyz.public.blob.vercel-storage.com/avatars/u1-9f8e.jpg",
      ),
    ).toBe(true);
  });

  it("is never true for Google's avatars", () => {
    expect(
      isOwnAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c"),
    ).toBe(false);
  });

  it("is false for no photo, or something that isn't a URL", () => {
    expect(isOwnAvatarUrl(null)).toBe(false);
    expect(isOwnAvatarUrl(undefined)).toBe(false);
    expect(isOwnAvatarUrl("")).toBe(false);
    expect(isOwnAvatarUrl("avatars/u1.jpg")).toBe(false);
  });

  it("doesn't trust look-alike hosts, other paths or plain http", () => {
    expect(
      isOwnAvatarUrl(
        "https://public.blob.vercel-storage.com.evil.com/avatars/u1.jpg",
      ),
    ).toBe(false);
    expect(
      isOwnAvatarUrl(
        "https://evilpublic.blob.vercel-storage.com/avatars/u.jpg",
      ),
    ).toBe(false);
    expect(
      isOwnAvatarUrl(
        "https://abc.public.blob.vercel-storage.com/other/u1-9f8e.jpg",
      ),
    ).toBe(false);
    expect(
      isOwnAvatarUrl(
        "http://abc.public.blob.vercel-storage.com/avatars/u1-9f8e.jpg",
      ),
    ).toBe(false);
  });
});
