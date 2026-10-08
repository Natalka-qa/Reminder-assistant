import { describe, expect, it } from "vitest";
import { looksLikeAddress, mapsHref, noteLines, shortUrl } from "./note-links";

describe("noteLines", () => {
  it("makes links tappable, the sentence's punctuation left out", () => {
    expect(
      noteLines("Book here: https://example.com/a?b=1, then pay."),
    ).toEqual([
      [
        { kind: "text", text: "Book here: " },
        {
          kind: "url",
          text: "https://example.com/a?b=1",
          href: "https://example.com/a?b=1",
        },
        { kind: "text", text: ", then pay." },
      ],
    ]);
  });

  it("opens www. links over https and keeps a link's own brackets", () => {
    expect(noteLines("(see www.site.es)")[0][1]).toEqual({
      kind: "url",
      text: "www.site.es",
      href: "https://www.site.es",
    });
    expect(
      noteLines("https://en.wikipedia.org/wiki/Foo_(bar)")[0][0],
    ).toMatchObject({ text: "https://en.wikipedia.org/wiki/Foo_(bar)" });
  });

  it("opens an address line in Google Maps", () => {
    expect(noteLines("Dentist\nCarrer de Mallorca 401, Barcelona")).toEqual([
      [{ kind: "text", text: "Dentist" }],
      [
        {
          kind: "place",
          text: "Carrer de Mallorca 401, Barcelona",
          href: mapsHref("Carrer de Mallorca 401, Barcelona"),
        },
      ],
    ]);
  });

  it("takes what follows an Address: label as the place", () => {
    expect(noteLines("Адрес: Крещатик 22, Киев")[0]).toEqual([
      { kind: "text", text: "Адрес: " },
      {
        kind: "place",
        text: "Крещатик 22, Киев",
        href: mapsHref("Крещатик 22, Киев"),
      },
    ]);
  });

  it("keeps empty lines, and plain text as it is", () => {
    expect(noteLines("Buy 2 l of milk\n\nCall mum")).toEqual([
      [{ kind: "text", text: "Buy 2 l of milk" }],
      [],
      [{ kind: "text", text: "Call mum" }],
    ]);
  });
});

describe("looksLikeAddress", () => {
  it.each([
    "ул. Ленина 5, кв. 12",
    "вул. Хрещатик, 22",
    "221B Baker St, London",
    "C/ de Balmes 150",
    "Avenida Diagonal 640",
    "Friedrichstraße 43",
    "12 rue de Rivoli, Paris",
  ])("reads %s as an address", (line) => {
    expect(looksLikeAddress(line)).toBe(true);
  });

  it.each([
    "Buy 2 l of milk",
    "Take 1st pill",
    "Call at 5",
    "Read pages 10–20",
    "ул. Ленина",
  ])("leaves %s alone", (line) => {
    expect(looksLikeAddress(line)).toBe(false);
  });
});

describe("shortUrl", () => {
  it("drops the scheme and www., and shortens a long one", () => {
    expect(shortUrl("https://www.example.com/")).toBe("example.com");
    expect(shortUrl("https://maps.app.goo.gl/AbCdEfGhIjKlMnOpQrStUv1234")).toBe(
      "maps.app.goo.gl/AbCdEfGhIjKlMnOpQrS…",
    );
  });
});
