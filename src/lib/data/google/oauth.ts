import { google } from "googleapis";
import { getGoogleOAuthConfig, GOOGLE_OAUTH_SCOPES } from "./config";
import type { GoogleTokenSession } from "./session";

export function createOAuth2Client() {
  const config = getGoogleOAuthConfig();
  if (!config) throw new Error("Google OAuth not configured");
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function getAuthorizationUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_OAUTH_SCOPES],
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  return credentials;
}

export function authClientFromSession(session: GoogleTokenSession) {
  const client = createOAuth2Client();
  if (!session.accessToken) throw new Error("Not authenticated");
  client.setCredentials({
    access_token: session.accessToken,
    refresh_token: session.refreshToken,
    expiry_date: session.expiresAt,
  });
  return client;
}

export async function getUserEmail(accessToken: string): Promise<string | undefined> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email ?? undefined;
}

export async function ensureValidSession(
  session: GoogleTokenSession
): Promise<GoogleTokenSession> {
  if (!isSessionExpired(session)) return session;
  if (!session.refreshToken) throw new Error("Session expired — reconnect Google");
  const creds = await refreshAccessToken(session.refreshToken);
  return {
    ...session,
    accessToken: creds.access_token!,
    expiresAt: creds.expiry_date ?? Date.now() + 3600_000,
  };
}

function isSessionExpired(session: GoogleTokenSession): boolean {
  if (!session.expiresAt) return true;
  return Date.now() >= session.expiresAt - 60_000;
}
