export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`"${timezone}" is not a valid IANA timezone identifier`);
    this.name = "InvalidTimezoneError";
  }
}

export class InvalidSchedulePreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSchedulePreferencesError";
  }
}

export class InvalidTelegramSummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTelegramSummaryError";
  }
}

export class InvalidReminderPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReminderPreferencesError";
  }
}
