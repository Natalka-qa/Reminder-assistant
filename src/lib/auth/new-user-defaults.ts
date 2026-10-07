// What a new account starts with beyond the column defaults. While email
// only reaches the Resend account's owner (no verified sender domain —
// isEmailSignInEnabled), a new user's reminder emails would never arrive:
// "Email reminders" starts off, so Settings says where reminders really go
// (Telegram and the app). Existing accounts are left as they are.
export function newUserDefaults(emailReachesAnyone: boolean): {
  emailRemindersEnabled?: boolean;
} {
  return emailReachesAnyone ? {} : { emailRemindersEnabled: false };
}
