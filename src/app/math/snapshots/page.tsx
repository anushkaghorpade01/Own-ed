"use client";

import { useApp } from "@/lib/store/app-store";
import { useFinanceModel } from "@/hooks/use-finance-model";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

export default function SnapshotsPage() {
  const { state, saveSnapshot } = useApp();
  const model = useFinanceModel();
  const [name, setName] = useState("");

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Enter a snapshot name");
      return;
    }
    saveSnapshot(name, undefined, {
      summary: model.summary,
      pl: { ebitda: model.pl.ebitda.toString(), netProfit: model.pl.netProfit.toString() },
    });
    toast.success("Snapshot saved — immutable");
    setName("");
  };

  return (
    <div>
      <SectionHeader
        title="Snapshots"
        description="Save dated financial snapshots. Snapshots are immutable and never change when live assumptions update."
      />
      <SampleBanner />

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Save snapshot</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pre-lease model – Sept 2026"
            className="flex-1 rounded-lg border border-[#E0DAD2] px-3 py-2 text-sm"
          />
          <Button onClick={handleSave}>Save snapshot</Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {state.snapshots.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[#A39E98]">
                {format(new Date(s.createdAt), "d MMM yyyy, HH:mm")} — Immutable
              </p>
              {s.notes && <p className="mt-2 text-sm text-[#6B6560]">{s.notes}</p>}
            </CardContent>
          </Card>
        ))}
        {state.snapshots.length === 0 && (
          <p className="text-sm text-[#A39E98]">No snapshots saved yet.</p>
        )}
      </div>
    </div>
  );
}
