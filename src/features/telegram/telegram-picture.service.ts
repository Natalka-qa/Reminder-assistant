import "server-only";
import type { User } from "@prisma/client";
import { env } from "@/lib/env";
import { formatDuration } from "@/lib/format";
import { readPictureText } from "@/lib/ocr/read-picture-text";
import { readPdfText } from "@/lib/pdf/read-pdf-text";
import {
  editTelegramMessage,
  sendTelegramMessage,
  sendTelegramMessageForId,
  downloadTelegramFile,
} from "@/lib/telegram/send-telegram-message";
import {
  NOTHING_IN_PDF_MESSAGE,
  NOTHING_IN_PICTURE_MESSAGE,
  PDF_FAILED_MESSAGE,
  PDF_WITHOUT_TEXT_MESSAGE,
  PICTURE_FAILED_MESSAGE,
  pictureDraftButtons,
  pictureDraftMessage,
  READING_PDF_MESSAGE,
  READING_PICTURE_MESSAGE,
} from "@/lib/telegram/bot-messages";
import { formatWhenDate } from "@/features/tasks/new-task-fields";
import { taskDraftService } from "@/features/task-drafts/task-draft.service";
import type { PictureOption } from "./picture-task";
import { extractPictureTasks } from "./picture-task";
import { localNow } from "./bot-view";

// sprint-24-tasks.md S24-03 / S24-05 — a picture sent to the bot: "Reading
// the picture…" at once, then that message becomes the first draft (more
// trips — more drafts below it). The picture is read in memory and
// dropped (решение 11); only the drafts are kept, until Add, Edit or
// Cancel.

/** "Fri, Oct 30 · 10:45–12:44 · 1 h 59 min"; a day alone — "Anytime". */
export function readingLabel(option: PictureOption, today: string): string {
  const day = formatWhenDate(option.date, today).replace(" · ", ", ");
  if (!option.time) return `${day} · Anytime`;
  const parts = [day, option.time];
  if (option.durationMinutes) {
    const [hours, minutes] = option.time.split(":").map(Number);
    const end = hours * 60 + minutes + option.durationMinutes;
    if (end < 24 * 60) {
      parts[1] = `${option.time}–${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
    }
    parts.push(formatDuration(option.durationMinutes));
  }
  return parts.join(" · ");
}

/** A saved draft as its message and buttons. */
export function draftReply(
  draft: {
    id: string;
    title: string;
    notes: string | null;
    options: PictureOption[];
  } & PictureOption,
  today: string,
) {
  const choosing = draft.options.length > 0;
  return {
    text: pictureDraftMessage({
      title: draft.title,
      whenLabel: choosing ? null : readingLabel(draft, today),
      notes: draft.notes,
      choosing,
    }),
    buttons: pictureDraftButtons({
      id: draft.id,
      appUrl: env.AUTH_URL,
      optionLabels: draft.options.map((option) => readingLabel(option, today)),
    }),
  };
}

/** A picture's text by OCR, a PDF's from inside it — the same rules after. */
const SOURCES = {
  picture: {
    read: readPictureText,
    reading: READING_PICTURE_MESSAGE,
    failed: PICTURE_FAILED_MESSAGE,
    noText: NOTHING_IN_PICTURE_MESSAGE,
    nothing: NOTHING_IN_PICTURE_MESSAGE,
  },
  // 2026-11-13 — a PDF ticket: its own text, no OCR; a scan has none.
  pdf: {
    read: readPdfText,
    reading: READING_PDF_MESSAGE,
    failed: PDF_FAILED_MESSAGE,
    noText: PDF_WITHOUT_TEXT_MESSAGE,
    nothing: NOTHING_IN_PDF_MESSAGE,
  },
} as const;

export async function readPictureTask(
  user: User,
  chatId: string,
  fileId: string,
  now: Date,
  kind: keyof typeof SOURCES = "picture",
): Promise<void> {
  const source = SOURCES[kind];
  const messageId = await sendTelegramMessageForId(chatId, source.reading);
  const { today } = localNow(now, user.timezone);

  let text: string;
  try {
    text = await source.read(await downloadTelegramFile(fileId));
  } catch (error) {
    console.error(`telegram ${kind} failed:`, error);
    await editTelegramMessage(chatId, messageId, source.failed);
    return;
  }

  if (!text.trim()) {
    await editTelegramMessage(chatId, messageId, source.noText);
    return;
  }
  const found = extractPictureTasks(text, today);
  if (found.length === 0) {
    await editTelegramMessage(chatId, messageId, source.nothing);
    return;
  }

  for (const [index, picture] of found.entries()) {
    const saved = await taskDraftService.save(user.id, picture);
    const reply = draftReply({ ...picture, id: saved.id }, today);
    await (index === 0
      ? editTelegramMessage(chatId, messageId, reply.text, reply.buttons, {
          html: true,
        })
      : sendTelegramMessage(chatId, reply.text, reply.buttons, {
          html: true,
        }));
  }
}
