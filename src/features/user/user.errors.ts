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

export class InvalidNameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidNameError";
  }
}

export class InvalidReminderPreferencesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReminderPreferencesError";
  }
}

export class InvalidAvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidAvatarError";
  }
}

// No Blob store connected (BLOB_READ_WRITE_TOKEN unset), or the store
// refused the upload — either way the photo isn't saved.
export class AvatarUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarUploadError";
  }
}
