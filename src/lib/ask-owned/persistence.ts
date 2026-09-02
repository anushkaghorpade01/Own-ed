import { idbGet, idbPut, STORE } from "@/lib/data/local/db";
import type { AskOwnedConversationEntry, OwnedAnswer } from "./types";

const HISTORY_KEY = "ask-owned-history";
const UNKNOWN_KEY = "ask-owned-unknown";
const MAX_HISTORY = 50;

export async function loadAskOwnedHistory(): Promise<AskOwnedConversationEntry[]> {
  try {
    const row = await idbGet<{ key: string; value: AskOwnedConversationEntry[] }>(
      STORE.uiPrefs,
      HISTORY_KEY
    );
    return row?.value ?? [];
  } catch {
    return [];
  }
}

export async function saveAskOwnedEntry(entry: AskOwnedConversationEntry): Promise<void> {
  const existing = await loadAskOwnedHistory();
  const next = [entry, ...existing].slice(0, MAX_HISTORY);
  await idbPut(STORE.uiPrefs, { key: HISTORY_KEY, value: next });
}

export async function clearAskOwnedHistory(): Promise<void> {
  await idbPut(STORE.uiPrefs, { key: HISTORY_KEY, value: [] });
}

export interface UnknownQuestionLog {
  question: string;
  route: string;
  category: string;
  timestamp: string;
}

export async function logUnknownQuestion(log: UnknownQuestionLog): Promise<void> {
  try {
    const row = await idbGet<{ key: string; value: UnknownQuestionLog[] }>(
      STORE.uiPrefs,
      UNKNOWN_KEY
    );
    const existing = row?.value ?? [];
    await idbPut(STORE.uiPrefs, {
      key: UNKNOWN_KEY,
      value: [log, ...existing].slice(0, 100),
    });
  } catch {
    // non-critical
  }
}

export function createConversationEntry(
  question: string,
  answer: OwnedAnswer,
  route: string,
  category: string
): AskOwnedConversationEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question,
    answer,
    route,
    timestamp: new Date().toISOString(),
    category: category as AskOwnedConversationEntry["category"],
  };
}
