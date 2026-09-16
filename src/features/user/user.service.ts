import { timezoneSchema } from "@/lib/validation/user";
import { userRepository } from "@/features/user/user.repository";
import { InvalidTimezoneError } from "@/features/user/user.errors";

export const userService = {
  async setTimezone(userId: string, timezone: string) {
    const result = timezoneSchema.safeParse(timezone);
    if (!result.success) {
      throw new InvalidTimezoneError(timezone);
    }
    return userRepository.updateTimezone(userId, result.data);
  },

  getProfile(userId: string) {
    return userRepository.findById(userId);
  },
};
