import { NextResponse } from "next/server";
import { getGoogleSession } from "@/lib/data/google/session";
import { GoogleSheetsStructuredDataRepository } from "@/lib/data/google/sheets-repository";
import { migrateLegacyAppState } from "@/lib/data/migration/local-to-normalized";

const LOCAL_STORAGE_KEY = "owned-app-state-v1";

export async function POST(request: Request) {
  try {
    const session = await getGoogleSession();
    if (!session.accessToken) {
      return NextResponse.json({ error: "Not connected to Google" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const legacyFromClient = body.legacyState as Record<string, unknown> | undefined;

    const repo = new GoogleSheetsStructuredDataRepository(
      async () => {
        const s = await getGoogleSession();
        if (!s.accessToken) throw new Error("Not connected");
        return s;
      },
      async (s) => {
        Object.assign(session, s);
        await session.save();
      }
    );

    let data;
    if (legacyFromClient) {
      const { data: migrated, flags } = migrateLegacyAppState(legacyFromClient);
      data = migrated;
      const result = await repo.saveAll(migrated);
      return NextResponse.json({ ...result, migrationFlags: flags });
    }

    data = await repo.loadAll();
    const result = await repo.saveAll(data);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getGoogleSession();
    if (!session.accessToken) {
      return NextResponse.json({ error: "Not connected" }, { status: 401 });
    }

    const repo = new GoogleSheetsStructuredDataRepository(
      async () => {
        const s = await getGoogleSession();
        if (!s.accessToken) throw new Error("Not connected");
        return s;
      },
      async (s) => {
        Object.assign(session, s);
        await session.save();
      }
    );

    const backup = await repo.exportStructuredBackup();
    return NextResponse.json(backup);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
