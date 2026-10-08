"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { noteLines, shortUrl } from "@/features/tasks/note-links";
import { isInsideTelegram, getTelegramWebApp } from "@/lib/telegram/web-app";

// 2026-10-08 — the task's note with its links and addresses tappable
// (features/tasks/note-links.ts): a link opens in a new tab, an address in
// Google Maps. Inside the Telegram Mini App both go through openLink, so
// they leave Telegram's webview for the browser — or the Maps app.
export function NoteText({ note }: { note: string }) {
  function open(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!isInsideTelegram()) return;
    event.preventDefault();
    getTelegramWebApp()?.openLink(event.currentTarget.href);
  }

  const link =
    "text-accent-text hover:text-accent-text-hover underline decoration-1 underline-offset-[3px] [overflow-wrap:anywhere]";

  return (
    <span className="flex flex-col items-end gap-1 text-right [overflow-wrap:anywhere]">
      {noteLines(note).map((segments, line) => (
        // Lines never reorder; an empty one keeps the note's spacing.
        <span key={line} className="min-h-[1lh]">
          {segments.map((segment, index) =>
            segment.kind === "text" ? (
              <span key={index}>{segment.text}</span>
            ) : (
              <a
                key={index}
                href={segment.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={open}
                className={link}
                aria-label={
                  segment.kind === "place"
                    ? `${segment.text}, open in Google Maps`
                    : undefined
                }
              >
                {segment.kind === "place" ? (
                  <MapPin
                    aria-hidden
                    className="mr-1 inline size-3.5 -translate-y-px"
                    strokeWidth={1.8}
                  />
                ) : null}
                {segment.kind === "url" ? shortUrl(segment.text) : segment.text}
                {segment.kind === "url" ? (
                  <ExternalLink
                    aria-hidden
                    className="ml-1 inline size-3 -translate-y-px"
                    strokeWidth={1.8}
                  />
                ) : null}
              </a>
            ),
          )}
        </span>
      ))}
    </span>
  );
}
