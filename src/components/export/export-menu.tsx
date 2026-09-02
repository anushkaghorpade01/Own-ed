"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Download, ChevronDown } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useApp } from "@/lib/store/app-store";
import { downloadFinancialExport } from "@/lib/export/download";
import {
  buildPageCsvExport,
  downloadPageCsv,
  getPageCsvPageTitle,
  pageCsvExportSupported,
} from "@/lib/export/page-csv";
import { toast } from "sonner";

const EXPORT_TOOLTIP =
  "Download a structured Excel copy of your current OWNED model, including assumptions, financial statements, capacity, funding, payback and model checks.\n\nThe export uses the same calculations as OWNED.";

const PAGE_CSV_TOOLTIP =
  "Download the main table for this page as CSV. Uses the same canonical finance engine — not a scrape of the screen.";

export function ExportMenu() {
  const { state } = useApp();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  const csvSupported = pageCsvExportSupported(pathname);
  const csvPageTitle = getPageCsvPageTitle(pathname);

  const runExport = async (mode: "full" | "quick") => {
    setBusy(true);
    try {
      const result = await downloadFinancialExport(
        {
          assumptions: state.assumptions,
          scenarios: state.scenarios,
        },
        mode
      );
      if (result.ok) {
        if (result.warnings.length > 0) {
          toast.success("Financial model downloaded.", {
            description: `${result.filename} — see MODEL CHECKS sheet for ${result.warnings.length} warning(s).`,
          });
        } else {
          toast.success("Financial model downloaded.", {
            description: result.filename,
          });
        }
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("OWNED found an issue while preparing the workbook.");
    } finally {
      setBusy(false);
    }
  };

  const runPageCsv = () => {
    setBusy(true);
    try {
      const table = buildPageCsvExport(pathname, {
        assumptions: state.assumptions,
        scenarios: state.scenarios,
      });
      if (!table || table.rows.length === 0) {
        toast.error("No tabular data available to export on this page.");
        return;
      }
      downloadPageCsv(table);
      toast.success("Page CSV downloaded.", {
        description: csvPageTitle?.replace(/_/g, " ") ?? "Current page",
      });
    } catch {
      toast.error("OWNED could not prepare the CSV for this page.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu.Root>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              disabled={busy}
              className="flex items-center gap-1.5 rounded-lg border border-[#E0DAD2] bg-white/60 px-3 py-1.5 text-xs font-semibold text-[#2C2825] hover:border-[#C4A882]/40 disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" />
              {busy ? "Preparing…" : "Export"}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenu.Trigger>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-xs rounded-md bg-[#2C2825] px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
            sideOffset={4}
          >
            {EXPORT_TOOLTIP.split("\n\n").map((p, i) => (
              <p key={i} className={i > 0 ? "mt-2" : undefined}>
                {p}
              </p>
            ))}
            <Tooltip.Arrow className="fill-[#2C2825]" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[220px] rounded-lg border border-[#E0DAD2] bg-white p-1 shadow-lg"
          sideOffset={6}
          align="end"
        >
          <DropdownMenu.Item
            className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium outline-none hover:bg-[#FAF8F5]"
            onSelect={() => void runExport("full")}
          >
            Full financial model (.xlsx)
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium outline-none hover:bg-[#FAF8F5]"
            onSelect={() => void runExport("quick")}
          >
            Quick financial summary (.xlsx)
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[#E8E2D9]" />
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <DropdownMenu.Item
                disabled={!csvSupported || busy}
                className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium outline-none hover:bg-[#FAF8F5] disabled:cursor-not-allowed disabled:opacity-50"
                onSelect={(e) => {
                  if (!csvSupported) {
                    e.preventDefault();
                    return;
                  }
                  runPageCsv();
                }}
              >
                Current page (.csv)
                {csvPageTitle && csvSupported && (
                  <span className="mt-0.5 block text-[10px] font-normal text-[#6B6560]">
                    {csvPageTitle.replace(/_/g, " ")}
                  </span>
                )}
              </DropdownMenu.Item>
            </Tooltip.Trigger>
            {csvSupported && (
              <Tooltip.Portal>
                <Tooltip.Content
                  className="z-50 max-w-xs rounded-md bg-[#2C2825] px-3 py-2 text-xs text-white shadow-lg"
                  sideOffset={4}
                >
                  {PAGE_CSV_TOOLTIP}
                  <Tooltip.Arrow className="fill-[#2C2825]" />
                </Tooltip.Content>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
          {!csvSupported && (
            <p className="px-3 py-1 text-[10px] leading-snug text-[#6B6560]">
              Open a Math page with a table (P&amp;L, Cash Flow, Sales Target, etc.) to export CSV.
            </p>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-[#E8E2D9]" />
          <DropdownMenu.Item
            disabled
            className="rounded-md px-3 py-2 text-[10px] leading-snug text-[#6B6560] outline-none"
          >
            Open in Google Sheets: upload the downloaded .xlsx manually. Direct sync is not
            connected yet.
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
