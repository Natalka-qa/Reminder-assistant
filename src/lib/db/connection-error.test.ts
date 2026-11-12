import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { isConnectionError, withConnectionRetry } from "./connection-error";

const unreachable = new Prisma.PrismaClientKnownRequestError("down", {
  code: "P1001",
  clientVersion: "6",
});
const badQuery = new Prisma.PrismaClientKnownRequestError("unique", {
  code: "P2002",
  clientVersion: "6",
});

describe("isConnectionError", () => {
  it("tells a connection failure from a bad query", () => {
    expect(isConnectionError(unreachable)).toBe(true);
    expect(
      isConnectionError(new Prisma.PrismaClientInitializationError("x", "6")),
    ).toBe(true);
    expect(isConnectionError(badQuery)).toBe(false);
    expect(isConnectionError(new Error("x"))).toBe(false);
  });
});

describe("withConnectionRetry", () => {
  it("tries once more after a connection failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const run = vi
      .fn()
      .mockRejectedValueOnce(unreachable)
      .mockResolvedValueOnce("ok");
    await expect(withConnectionRetry(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("doesn't retry other errors", async () => {
    const run = vi.fn().mockRejectedValue(badQuery);
    await expect(withConnectionRetry(run)).rejects.toBe(badQuery);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
