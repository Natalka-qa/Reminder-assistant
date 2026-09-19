// After this many failed send attempts, a notification stops retrying and
// is marked FAILED for good (no exponential backoff — see
// sprint-6-tasks.md "Расхождения" п.8).
export const MAX_NOTIFICATION_ATTEMPTS = 3;
