"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function isSpeechDictationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

// Starts false (matching SSR, which has no `window`) and corrects itself
// once mounted in the browser — computing this directly during render
// would mismatch the server-rendered HTML against the client's first
// render, the hydration error React reports as "server rendered HTML
// didn't match the client" (node_modules/next/dist/docs/01-app/02-guides/
// preventing-flash-before-hydration.md § "Why not useEffect?": this
// pattern is correctness-safe, its only cost is the button popping in a
// tick after mount instead of being there immediately — acceptable for a
// non-critical mic button). useSyncExternalStore is the wrong tool for
// this despite looking like a fit: its contract needs a real subscription
// that fires when the value changes, and browser support for
// SpeechRecognition never changes after mount, so there's nothing to
// subscribe to — without a firing subscription React has no signal to
// reconcile after hydration, which is exactly the mismatch this was
// meant to avoid.
function useSpeechDictationSupport(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time post-hydration correction, see comment above
    setSupported(isSpeechDictationSupported());
  }, []);
  return supported;
}

function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// A user tapping "stop" (aborted) or simply not saying anything (no-speech)
// both surface as onerror in some browsers — neither is a real failure
// worth alarming the caller about (sprint-9-tasks.md "Расхождения" п.7).
const SILENT_ERROR_CODES = new Set(["aborted", "no-speech"]);

// Single-shot dictation (sprint-9-tasks.md "Расхождения" п.6): one
// SpeechRecognition instance per start()/stop() cycle, not open-ended
// listening. `onTranscriptChange` fires on every interim result (for live
// feedback in the field) and once more with isFinal=true when the phrase
// settles.
export function useSpeechDictation({
  onTranscriptChange,
  onError,
  lang = "en-US",
}: {
  onTranscriptChange: (text: string, isFinal: boolean) => void;
  onError?: (code: string) => void;
  lang?: string;
}) {
  const [listening, setListening] = useState(false);
  const supported = useSpeechDictationSupport();
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Refs so start() doesn't need onTranscriptChange/onError in its own
  // dependency array — callers typically pass fresh inline closures every
  // render, which would otherwise tear down and rebuild the callback stack
  // on every keystroke elsewhere in the form. Synced in an effect, not
  // during render (react-hooks/refs forbids writing a ref mid-render).
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange;
    onErrorRef.current = onError;
  });

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        transcript += result[0]?.transcript ?? "";
        isFinal = result.isFinal;
      }
      onTranscriptChangeRef.current(transcript, isFinal);
    };
    recognition.onerror = (event) => {
      if (!SILENT_ERROR_CODES.has(event.error)) {
        onErrorRef.current?.(event.error);
      }
    };
    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  // Stop any in-flight recognition if the component unmounts mid-dictation.
  useEffect(() => stop, [stop]);

  return {
    supported,
    listening,
    toggle,
  };
}
