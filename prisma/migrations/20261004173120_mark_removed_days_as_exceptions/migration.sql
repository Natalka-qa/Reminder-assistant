-- sprint-19-tasks.md п.17 — days already taken out of an active series with
-- "Remove this one" become exceptions, so a later change to the series'
-- time or days no longer brings them back. An active recurring task's
-- CANCELLED days only ever come from "Remove this one" (deactivating makes
-- the task inactive).
UPDATE "TaskOccurrence" AS o
SET "isException" = true
FROM "Task" AS t
WHERE t."id" = o."taskId"
  AND t."active" = true
  AND t."recurrenceRule" IS NOT NULL
  AND o."status" = 'CANCELLED';
