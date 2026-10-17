import "server-only";
import type { PictureDraft } from "@/features/telegram/picture-task";
import { taskDraftRepository } from "./task-draft.repository";
import { DRAFT_LIFETIME_MS, draftOptions } from "./task-draft-view";

// sprint-24-tasks.md S24-04 — drafts read from a picture, until Add, Edit
// (Save in New task) or Cancel. Ownership is every call's where.
export const taskDraftService = {
  save(userId: string, draft: PictureDraft) {
    return taskDraftRepository.create(userId, {
      title: draft.title,
      date: draft.date,
      time: draft.time,
      durationMinutes: draft.durationMinutes,
      notes: draft.notes,
      options: draft.options,
    });
  },

  async get(userId: string, id: string) {
    const draft = await taskDraftRepository.findOwned(userId, id);
    return draft ? { ...draft, options: draftOptions(draft.options) } : null;
  },

  /** решение 4 — one of the readings becomes the draft's own; null if none. */
  async choose(userId: string, id: string, index: number) {
    const draft = await taskDraftService.get(userId, id);
    const option = draft?.options[index];
    if (!draft || !option) return null;
    await taskDraftRepository.update(userId, id, { ...option, options: [] });
    return { ...draft, ...option, options: [] };
  },

  async delete(userId: string, id: string): Promise<void> {
    await taskDraftRepository.delete(userId, id);
  },

  /** решение 12 — the daily cron: drafts nobody answered in 24 hours. */
  async deleteExpired(now: Date): Promise<number> {
    const { count } = await taskDraftRepository.deleteCreatedBefore(
      new Date(now.getTime() - DRAFT_LIFETIME_MS),
    );
    return count;
  },
};
