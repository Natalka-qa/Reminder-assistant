import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { DateTime } from "luxon";
import { env } from "@/lib/env";
import { zonedNow } from "@/lib/date";
import {
  dateStringSchema,
  timeStringSchema,
  prioritySchema,
  flexibilitySchema,
  repeatFrequencySchema,
} from "@/lib/validation/task";

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

// Fast/cheap model for a single structured-extraction call, not the "think
// hard" tier — see sprint-8-tasks.md §5 (Risks).
const MODEL = "claude-haiku-4-5";
const REQUEST_TIMEOUT_MS = 15_000;

const SUBMIT_TOOL_NAME = "submit_task_draft";
const FAILURE_TOOL_NAME = "report_parse_failure";

const FALLBACK_MESSAGE =
  "Couldn't understand that — fill in the form manually.";

const submitInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  date: dateStringSchema,
  time: timeStringSchema,
  durationMinutes: z.number().int().min(0).max(1440).nullish(),
  priority: prioritySchema.nullish(),
  flexibility: flexibilitySchema.nullish(),
  repeatFrequency: repeatFrequencySchema.nullish(),
  repeatDaysOfWeek: z.array(z.number().int().min(1).max(7)).nullish(),
});
type SubmitInput = z.infer<typeof submitInputSchema>;

const failureInputSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export type TaskDraft = {
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  priority: z.infer<typeof prioritySchema>;
  flexibility: z.infer<typeof flexibilitySchema>;
  repeatFrequency: z.infer<typeof repeatFrequencySchema>;
  repeatDaysOfWeek: number[];
};

export type TaskDraftResult =
  { ok: true; draft: TaskDraft } | { ok: false; message: string };

// Mirrors the defaults `/tasks/new` seeds the form with, so a field the
// model didn't extract lands on the same value the form would already show —
// applying the draft is safe to do unconditionally, field by field.
export function toTaskDraft(input: SubmitInput): TaskDraft {
  return {
    title: input.title,
    description: input.description ?? "",
    date: input.date,
    time: input.time,
    durationMinutes: input.durationMinutes ?? 30,
    priority: input.priority ?? "NORMAL",
    flexibility: input.flexibility ?? "FLEXIBLE",
    repeatFrequency: input.repeatFrequency ?? "NONE",
    repeatDaysOfWeek: input.repeatDaysOfWeek ?? [],
  };
}

function buildTools(): Anthropic.Tool[] {
  return [
    {
      name: SUBMIT_TOOL_NAME,
      description:
        "Submit the extracted task fields. Only call this when the title, date, and time can be confidently determined from the user's text — never guess a value you aren't confident about.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short task title, taken from the user's text.",
          },
          description: {
            type: "string",
            description:
              "Optional longer description, only if the text has detail beyond the title.",
          },
          date: {
            type: "string",
            description:
              "Calendar date in YYYY-MM-DD format, resolved against the given current date.",
          },
          time: {
            type: "string",
            description: "Time of day in 24-hour HH:mm format.",
          },
          durationMinutes: {
            type: "integer",
            description:
              'Duration in minutes, only if stated or clearly implied (e.g. "for an hour" = 60).',
          },
          priority: {
            type: "string",
            enum: ["LOW", "NORMAL", "HIGH", "CRITICAL"],
            description:
              "Only set if the text explicitly signals urgency or importance.",
          },
          flexibility: {
            type: "string",
            enum: ["FIXED", "FLEXIBLE"],
            description:
              "FIXED if the text implies the time can't move, FLEXIBLE otherwise.",
          },
          repeatFrequency: {
            type: "string",
            enum: ["NONE", "DAILY", "WEEKLY", "MONTHLY"],
            description:
              "Only set if the text explicitly describes a recurring task.",
          },
          repeatDaysOfWeek: {
            type: "array",
            items: { type: "integer" },
            description:
              "Days of week the task repeats on (1=Monday..7=Sunday), only when repeatFrequency is WEEKLY.",
          },
        },
        required: ["title", "date", "time"],
        additionalProperties: false,
      },
    },
    {
      name: FAILURE_TOOL_NAME,
      description:
        "Call this instead of submit_task_draft when the title, date, or time can't be confidently determined from the text. Never guess.",
      strict: true,
      input_schema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description:
              "Short, user-facing explanation of what's missing or unclear.",
          },
        },
        required: ["message"],
        additionalProperties: false,
      },
    },
  ];
}

function buildSystemPrompt(now: DateTime, timezone: string): string {
  const nowLabel = now.toFormat("cccc, yyyy-LL-dd HH:mm");
  return [
    "You turn a short free-text task description into structured fields for a task-tracking app.",
    `The user's current date and time is ${nowLabel}, in the "${timezone}" timezone — resolve relative dates ("today", "tomorrow", "next Monday", etc.) against this, never your own assumption of the current date.`,
    "Always call exactly one of the two provided tools.",
  ].join("\n");
}

export async function parseTaskDraft(
  text: string,
  options: { timezone: string; now?: DateTime },
): Promise<TaskDraftResult> {
  const now = options.now ?? zonedNow(options.timezone);

  let response: Anthropic.Message;
  try {
    response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: buildSystemPrompt(now, options.timezone),
        tools: buildTools(),
        tool_choice: { type: "any", disable_parallel_tool_use: true },
        messages: [{ role: "user", content: text }],
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
  } catch {
    return { ok: false, message: FALLBACK_MESSAGE };
  }

  if (
    response.stop_reason === "refusal" ||
    response.stop_reason === "max_tokens"
  ) {
    return { ok: false, message: FALLBACK_MESSAGE };
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) {
    return { ok: false, message: FALLBACK_MESSAGE };
  }

  if (toolUse.name === FAILURE_TOOL_NAME) {
    const parsed = failureInputSchema.safeParse(toolUse.input);
    return {
      ok: false,
      message: parsed.success ? parsed.data.message : FALLBACK_MESSAGE,
    };
  }

  const parsed = submitInputSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return { ok: false, message: FALLBACK_MESSAGE };
  }

  return { ok: true, draft: toTaskDraft(parsed.data) };
}

export const taskDraftService = { parseTaskDraft };
