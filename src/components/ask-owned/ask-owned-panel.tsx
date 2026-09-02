"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Send, Trash2, Shield, Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { useSpeechInput } from "@/hooks/use-speech-input";
import {
  answerOwnedQuestion,
  classifyOwnedQuestion,
  getOwnedPageContext,
  loadAskOwnedHistory,
  saveAskOwnedEntry,
  clearAskOwnedHistory,
  logUnknownQuestion,
  createConversationEntry,
  parseOccupancyFromQuestion,
  parseFullClassSize,
  type CalculationSnapshot,
  type OwnedAnswer,
} from "@/lib/ask-owned";

interface AskOwnedPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  answer?: OwnedAnswer;
}

export function AskOwnedPanel({ open, onOpenChange }: AskOwnedPanelProps) {
  const pathname = usePathname();
  const { state, updateAssumptions } = useApp();
  const model = useFinanceModel();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [occupancyHint, setOccupancyHint] = useState<number | undefined>();
  const [classSizeHint, setClassSizeHint] = useState<number | undefined>();
  const [calcSnapshot, setCalcSnapshot] = useState<CalculationSnapshot | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<(q: string) => void>(() => {});
  const page = getOwnedPageContext(pathname);

  const speech = useSpeechInput({
    onInterimTranscript: (text) => setInput(text),
    onFinalTranscript: (text) => {
      setInput(text);
      submitRef.current(text);
    },
  });

  useEffect(() => {
    if (!open) speech.stopListening();
  }, [open, speech.stopListening]);

  useEffect(() => {
    if (!open) return;
    loadAskOwnedHistory().then((history) => {
      if (history.length === 0) return;
      const restored: ChatMessage[] = [];
      for (const entry of [...history].reverse()) {
        restored.push({ role: "user", content: entry.question });
        restored.push({
          role: "assistant",
          content: entry.answer.sections.map((s) => s.body).join("\n\n"),
          answer: entry.answer,
        });
      }
      setMessages(restored);
    });
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const submit = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || pending) return;

      setInput("");
      setMessages((m) => [...m, { role: "user", content: q }]);
      setPending(true);

      const parsedOcc = parseOccupancyFromQuestion(q);
      const parsedSize = parseFullClassSize(q, state.assumptions.maxGroupClassSize);
      const occHint = parsedOcc ?? occupancyHint;
      if (parsedOcc != null) setOccupancyHint(parsedOcc);
      if (parsedSize !== state.assumptions.maxGroupClassSize) setClassSizeHint(parsedSize);

      const ctx = {
        pathname,
        assumptions: state.assumptions,
        model,
        occupancyHint: occHint,
        classSizeHint: classSizeHint ?? parsedSize,
        calculationSnapshot: calcSnapshot,
      };
      const category = classifyOwnedQuestion(q, pathname);
      const answer = answerOwnedQuestion(q, ctx);

      if (answer.calculationSnapshot) setCalcSnapshot(answer.calculationSnapshot);

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: answer.sections.map((s) => s.body).join("\n\n"),
          answer,
        },
      ]);

      const entry = createConversationEntry(q, answer, pathname, category);
      await saveAskOwnedEntry(entry);

      if (answer.isFallback) {
        await logUnknownQuestion({
          question: q,
          route: pathname,
          category,
          timestamp: entry.timestamp,
        });
      }

      setPending(false);
    },
    [pending, pathname, state.assumptions, model, occupancyHint, classSizeHint, calcSnapshot]
  );

  submitRef.current = (q: string) => {
    void submit(q);
  };

  const handleClear = async () => {
    setMessages([]);
    setOccupancyHint(undefined);
    setClassSizeHint(undefined);
    setCalcSnapshot(undefined);
    await clearAskOwnedHistory();
  };

  const handleApplyWhatIf = (answer: OwnedAnswer) => {
    if (!answer.whatIfApply) return;
    updateAssumptions(answer.whatIfApply.patch);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: "Applied to your assumptions. Dependent numbers will update across the model.",
      },
    ]);
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close Ask OWNED"
        className="fixed inset-0 z-50 bg-black/20 md:bg-black/10"
        onClick={() => onOpenChange(false)}
      />
      <aside
        className={cn(
          "fixed z-50 flex flex-col border-[#E8E2D9] bg-[#FAF8F5] shadow-xl",
          "inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[min(100%,24rem)] md:border-l"
        )}
      >
        <header className="shrink-0 border-b border-[#E8E2D9] px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-wordmark text-lg tracking-tight text-[#2C2825]">Ask OWNED</h2>
              <p className="mt-0.5 text-xs text-[#6B6560]">
                Ask about this page, your numbers, or how OWNED works.
              </p>
              <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#A39E98]">
                <Shield className="h-3 w-3" />
                Local — runs on this device
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-[#A39E98] hover:bg-[#F0EBE3] hover:text-[#2C2825]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#A39E98]">
            Answers based on your OWNED model and guide. Your data is not sent anywhere.
          </p>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs text-[#6B6560]">Suggested for {page.title}:</p>
              <div className="flex flex-wrap gap-2">
                {page.suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => submit(q)}
                    className="rounded-full border border-[#E0DAD2] bg-white px-3 py-1.5 text-left text-xs text-[#2C2825] hover:border-[#C4A882]/50 hover:bg-[#F0EBE3]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-6 bg-[#2C2825] text-[#FAF8F5]"
                    : "mr-2 border border-[#E8E2D9] bg-white text-[#2C2825]"
                )}
              >
                {msg.answer?.sections.map((section, si) => (
                  <div key={si} className={si > 0 ? "mt-3 border-t border-[#E8E2D9] pt-3" : ""}>
                    {section.title && (
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#A39E98]">
                        {section.title}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap leading-relaxed">{section.body}</p>
                  </div>
                ))}
                {!msg.answer && <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>}

                {msg.answer?.guideLinks && msg.answer.guideLinks.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-[#E8E2D9] pt-2">
                    <p className="text-[10px] uppercase tracking-wide text-[#A39E98]">Read more</p>
                    {msg.answer.guideLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block text-xs font-medium text-[#8B6914] hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}

                {msg.answer?.whatIfApply && (
                  <button
                    type="button"
                    onClick={() => handleApplyWhatIf(msg.answer!)}
                    className="mt-3 rounded-lg bg-[#2C2825] px-3 py-1.5 text-xs font-medium text-[#FAF8F5] hover:bg-[#3d3834]"
                  >
                    {msg.answer.whatIfApply.label}
                  </button>
                )}
              </div>
            ))}
            {pending && (
              <p className="text-xs text-[#A39E98]">Looking up your model…</p>
            )}
          </div>
        </div>

        <footer className="shrink-0 border-t border-[#E8E2D9] px-4 py-3">
          {speech.error && (
            <p className="mb-2 text-[11px] text-amber-800">{speech.error}</p>
          )}
          {speech.listening && (
            <p className="mb-2 text-[11px] text-[#6B6560]">Listening… speak your question</p>
          )}
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(input);
                }
              }}
              placeholder={speech.listening ? "Listening…" : "Ask OWNED something..."}
              className="flex-1 rounded-lg border border-[#E0DAD2] bg-white px-3 py-2 text-sm text-[#2C2825] outline-none placeholder:text-[#A39E98] focus:border-[#C4A882]/60"
            />
            {speech.supported && (
              <button
                type="button"
                onClick={speech.toggleListening}
                disabled={pending}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  speech.listening
                    ? "bg-red-100 text-red-700"
                    : "border border-[#E0DAD2] bg-white text-[#2C2825] hover:bg-[#F0EBE3]"
                )}
                aria-label={speech.listening ? "Stop microphone" : "Ask with microphone"}
                title={speech.listening ? "Stop recording" : "Speak your question"}
              >
                {speech.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => submit(input)}
              disabled={!input.trim() || pending}
              className="rounded-lg bg-[#2C2825] p-2 text-[#FAF8F5] disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="mt-2 flex items-center gap-1 text-[11px] text-[#A39E98] hover:text-[#6B6560]"
            >
              <Trash2 className="h-3 w-3" />
              Clear conversation
            </button>
          )}
        </footer>
      </aside>
    </>
  );
}
