export class InvalidTimezoneError extends Error {
  constructor(timezone: string) {
    super(`"${timezone}" is not a valid IANA timezone identifier`);
    this.name = "InvalidTimezoneError";
  }
}
