// 2026-10-16 — "Отмена" on Google's consent screen comes back as
// /api/auth/callback/<provider>?error=access_denied without `iss`. Auth.js
// (oauth4webapi) insists on `iss` from Google and fails before it reads the
// error: "Server error — a problem with the server configuration". So a
// provider's error is answered here, before Auth.js: back to where the
// flow started — Settings for the calendar connection, /login for sign-in.
// Pure: the route passes the request's URL.

const CALLBACK = /^\/api\/auth\/callback\/([^/]+)$/;

export function providerErrorRedirect(
  url: URL,
  calendarProviderId: string,
): string | null {
  const callback = CALLBACK.exec(url.pathname);
  if (!callback || !url.searchParams.has("error")) return null;
  const path = callback[1] === calendarProviderId ? "/settings" : "/login";
  return new URL(path, url.origin).toString();
}
