import { describe, expect, it } from "vitest";
import { parseFreeBusyResponse } from "./query-free-busy";

const at = (iso: string) => new Date(iso);

describe("parseFreeBusyResponse", () => {
  it("reads the primary calendar's busy intervals as Dates", () => {
    expect(
      parseFreeBusyResponse({
        kind: "calendar#freeBusy",
        timeMin: "2026-09-25T00:00:00.000Z",
        timeMax: "2026-09-26T00:00:00.000Z",
        calendars: {
          primary: {
            busy: [
              { start: "2026-09-25T12:00:00Z", end: "2026-09-25T13:00:00Z" },
              {
                start: "2026-09-25T16:30:00+02:00",
                end: "2026-09-25T17:00:00+02:00",
              },
            ],
          },
        },
      }),
    ).toEqual({
      status: "ok",
      busy: [
        { start: at("2026-09-25T12:00:00Z"), end: at("2026-09-25T13:00:00Z") },
        { start: at("2026-09-25T14:30:00Z"), end: at("2026-09-25T15:00:00Z") },
      ],
    });
  });

  it("keeps only start and end, whatever else an interval carries", () => {
    const result = parseFreeBusyResponse({
      calendars: {
        primary: {
          busy: [
            {
              start: "2026-09-25T12:00:00Z",
              end: "2026-09-25T13:00:00Z",
              summary: "Should never be here",
            },
          ],
        },
      },
    });
    expect(result.status === "ok" && Object.keys(result.busy[0])).toEqual([
      "start",
      "end",
    ]);
  });

  it("reads a free day — empty or missing busy — as ok with nothing busy", () => {
    expect(
      parseFreeBusyResponse({ calendars: { primary: { busy: [] } } }),
    ).toEqual({ status: "ok", busy: [] });
    expect(parseFreeBusyResponse({ calendars: { primary: {} } })).toEqual({
      status: "ok",
      busy: [],
    });
  });

  it("treats errors on the primary calendar as unavailable, not free", () => {
    expect(
      parseFreeBusyResponse({
        calendars: {
          primary: {
            errors: [{ domain: "global", reason: "internalError" }],
            busy: [],
          },
        },
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the primary calendar is missing", () => {
    expect(parseFreeBusyResponse({ calendars: {} })).toEqual({
      status: "unavailable",
    });
    expect(
      parseFreeBusyResponse({
        calendars: { "someone@example.com": { busy: [] } },
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("is unavailable for anything that isn't a freeBusy reply", () => {
    for (const json of [
      null,
      "not json",
      42,
      {},
      { calendars: { primary: { busy: "soon" } } },
      {
        calendars: {
          primary: { busy: [{ start: "tomorrow", end: "later" }] },
        },
      },
    ]) {
      expect(parseFreeBusyResponse(json)).toEqual({ status: "unavailable" });
    }
  });

  it("drops an interval that ends before it starts", () => {
    expect(
      parseFreeBusyResponse({
        calendars: {
          primary: {
            busy: [
              { start: "2026-09-25T13:00:00Z", end: "2026-09-25T12:00:00Z" },
              { start: "2026-09-25T13:00:00Z", end: "2026-09-25T13:00:00Z" },
            ],
          },
        },
      }),
    ).toEqual({ status: "ok", busy: [] });
  });
});
