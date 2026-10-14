/** Base URL of the admin portal (admin-web), where /login lives. No trailing slash. */
export const ADMIN_WEB_URL = (
  import.meta.env["VITE_ADMIN_WEB_URL"] ?? "http://localhost:8080"
).replace(/\/+$/, "");

export const LOGIN_URL = `${ADMIN_WEB_URL}/login`;

/** Where privacy and legal questions go; shown on the Privacy Policy and Terms pages. */
export const CONTACT_EMAIL = import.meta.env["VITE_CONTACT_EMAIL"] ?? "admin@kempanna.com";

export const LEGAL_UPDATED = "14 October 2026";
