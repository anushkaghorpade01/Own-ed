import { NextResponse } from "next/server";
import { getGoogleSession } from "@/lib/data/google/session";

export async function GET() {
  try {
    const session = await getGoogleSession();
    if (!session.accessToken) {
      return NextResponse.json({ connected: false, syncStatus: "offline", pendingWriteCount: 0 });
    }
    return NextResponse.json({
      connected: true,
      googleAccountEmail: session.email,
      sheetId: session.sheetId,
      driveFolderId: session.driveFolderId,
      syncStatus: "saved",
      pendingWriteCount: 0,
    });
  } catch {
    return NextResponse.json({ connected: false, syncStatus: "offline", pendingWriteCount: 0 });
  }
}

export async function DELETE() {
  const session = await getGoogleSession();
  session.destroy();
  return NextResponse.json({ connected: false });
}
