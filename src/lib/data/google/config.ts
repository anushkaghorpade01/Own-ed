/** Google OAuth scopes — minimum practical access for Own-ed MVP */

export const GOOGLE_OAUTH_SCOPES = [
  /** Read/write the connected OWN-ED DATA spreadsheet */
  "https://www.googleapis.com/auth/spreadsheets",
  /** Access files/folders created or opened by Own-ed (not full Drive) */
  "https://www.googleapis.com/auth/drive.file",
  /** Read user email for Settings display */
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export const GOOGLE_OAUTH_STATE_COOKIE = "owned-google-oauth-state";
export const GOOGLE_TOKEN_COOKIE = "owned-google-session";
