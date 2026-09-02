import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface GoogleTokenSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  sheetId?: string;
  driveFolderId?: string;
}

export const googleSessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET ?? "dev-only-change-in-production-32chars!!",
  cookieName: "owned-google-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 30,
  },
};

export async function getGoogleSession() {
  return getIronSession<GoogleTokenSession>(await cookies(), googleSessionOptions);
}

export function isTokenExpired(session: GoogleTokenSession): boolean {
  if (!session.expiresAt) return true;
  return Date.now() >= session.expiresAt - 60_000;
}
