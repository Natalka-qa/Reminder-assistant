import { afterEach, describe, expect, it, vi } from "vitest";
import { isSpeechDictationSupported } from "./use-speech-dictation";

describe("isSpeechDictationSupported", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false with no window (server-side render)", () => {
    expect(isSpeechDictationSupported()).toBe(false);
  });

  it("is false when window exists but neither constructor does", () => {
    vi.stubGlobal("window", {});
    expect(isSpeechDictationSupported()).toBe(false);
  });

  it("is true when the unprefixed constructor exists", () => {
    vi.stubGlobal("window", { SpeechRecognition: class {} });
    expect(isSpeechDictationSupported()).toBe(true);
  });

  it("is true when only the webkit-prefixed constructor exists", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: class {} });
    expect(isSpeechDictationSupported()).toBe(true);
  });
});
