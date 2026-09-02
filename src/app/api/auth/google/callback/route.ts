import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  getUserEmail,
} from "@/lib/data/google/oauth";
import {
  findOrCreateSpreadsheet,
  findOrCreateDriveFolder,
} from "@/lib/data/google/sheets-client";
import { getGoogleSession } from "@/lib/data/google/session";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/data/google/config";
import type { GoogleTokenSession } from "@/lib/data/google/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/settings/data?error=oauth_state", request.url));
  }

  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.access_token) {
      return NextResponse.redirect(new URL("/settings/data?error=no_token", request.url));
    }

    const email = await getUserEmail(tokens.access_token);
    const sessionData: GoogleTokenSession = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? undefined,
      expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
      email,
    };

    const sheetId = await findOrCreateSpreadsheet(sessionData);
    const driveFolderId = await findOrCreateDriveFolder(sessionData);
    sessionData.sheetId = sheetId;
    sessionData.driveFolderId = driveFolderId;

    const session = await getGoogleSession();
    Object.assign(session, sessionData);
    await session.save();

    return NextResponse.redirect(new URL("/settings/data?connected=1", request.url));
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/settings/data?error=callback", request.url));
  }
}
