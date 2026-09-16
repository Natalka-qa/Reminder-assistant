import { z } from "zod";

const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));

export const timezoneSchema = z
  .string()
  .refine((tz) => validTimezones.has(tz), {
    message: "Not a valid IANA timezone identifier",
  });
