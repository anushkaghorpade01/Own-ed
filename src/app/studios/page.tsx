"use client";

import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format/currency";
import { useState } from "react";
import {
  StudioEditor,
  studioCardClass,
  studioSummaryFilled,
} from "@/components/studios/studio-editor";
import type { Studio } from "@/lib/finance/schemas";
import { Pencil, Download } from "lucide-react";
import { downloadStudiosExport } from "@/lib/export/download-studios";
import { toast } from "sonner";

function newStudio(): Studio {
  const now = new Date().toISOString();
  return {
    id: `studio-${Date.now()}`,
    name: "New studio",
    location: "",
    visited: false,
    classFormats: [],
    packPrices: {},
    ratings: {},
    imageUrls: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function StudiosPage() {
  const { state, addStudio, updateStudio, deleteStudio } = useApp();
  const [compare, setCompare] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const editingStudio = state.studios.find((s) => s.id === editingId);

  const toggleCompare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleAddStudio = () => {
    const studio = newStudio();
    addStudio(studio);
    setEditingId(studio.id);
  };

  const handleDeleteStudio = (id: string) => {
    if (!confirm("Delete this studio and all its notes?")) return;
    deleteStudio(id);
    setEditingId(null);
  };

  const handleExport = async () => {
    if (state.studios.length === 0) {
      toast.error("Add at least one studio before exporting.");
      return;
    }
    setExportBusy(true);
    try {
      const result = await downloadStudiosExport(state.studios);
      if (result.ok) {
        toast.success("Studios workbook downloaded.", { description: result.filename });
      } else {
        toast.error(result.error);
      }
    } finally {
      setExportBusy(false);
    }
  };

  const compared = state.studios.filter((s) => compare.includes(s.id));

  return (
    <div>
      <SectionHeader
        title="Studios"
        description="Private competitor and studio intelligence database."
        action={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={exportBusy || state.studios.length === 0}
              onClick={() => void handleExport()}
            >
              <Download className="mr-1 h-4 w-4" />
              {exportBusy ? "Preparing…" : "Export Excel"}
            </Button>
            <Button size="sm" onClick={handleAddStudio}>
              Add studio
            </Button>
          </div>
        }
      />
      <SampleBanner />

      {state.studios.length === 0 && (
        <div className="card-surface mb-8 py-16 text-center">
          <p className="text-[#6B6560]">No studios yet.</p>
          <p className="mt-1 text-sm text-[#A39E98]">
            Add a studio you visited to capture pricing, vibe, and what OWN could learn.
          </p>
          <Button type="button" className="mt-4" size="sm" onClick={handleAddStudio}>
            Add your first studio
          </Button>
        </div>
      )}

      {compared.length >= 2 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Side-by-side comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[#A39E98]">
                    <th className="pb-2 pr-4">Metric</th>
                    {compared.map((s) => (
                      <th key={s.id} className="pb-2 pr-4">
                        {s.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Drop-in</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">
                        {s.dropInPrice ? formatINR(s.dropInPrice) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Reformers</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">
                        {s.reformers ?? "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Class size</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">
                        {s.maxClassSize ?? "—"}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Rating</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">
                        {s.personalRating ? `${s.personalRating}/10` : "—"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {state.studios.map((studio) => (
          <Card
            key={studio.id}
            className={studioCardClass(editingId === studio.id)}
            onClick={() => setEditingId(studio.id)}
          >
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{studio.name}</CardTitle>
                <p className="text-sm text-[#6B6560]">{studio.location || "Add location…"}</p>
              </div>
              <div className="flex items-center gap-2">
                {!studioSummaryFilled(studio) && (
                  <Badge variant="outline" className="text-[10px]">
                    Tap to edit
                  </Badge>
                )}
                {studio.visited && <Badge variant="success">Visited</Badge>}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(studio.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[#A39E98] hover:text-[#2C2825]"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => toggleCompare(studio.id, e)}
                  className={`text-xs ${compare.includes(studio.id) ? "font-medium text-[#2C2825]" : "text-[#A39E98]"}`}
                >
                  Compare
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-[#A39E98]">Drop-in</p>
                  <p>{studio.dropInPrice ? formatINR(studio.dropInPrice) : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A39E98]">Reformers</p>
                  <p>{studio.reformers ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A39E98]">Class size</p>
                  <p>{studio.maxClassSize ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#A39E98]">Rating</p>
                  <p>{studio.personalRating ? `${studio.personalRating}/10` : "—"}</p>
                </div>
              </div>
              {studio.liked && (
                <div>
                  <p className="text-xs font-medium text-[#A39E98]">What I liked</p>
                  <p className="line-clamp-2 text-[#6B6560]">{studio.liked}</p>
                </div>
              )}
              {studio.ownCouldLearn && (
                <div>
                  <p className="text-xs font-medium text-[#A39E98]">OWN could learn</p>
                  <p className="line-clamp-2 text-[#6B6560]">{studio.ownCouldLearn}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {editingStudio && (
        <StudioEditor
          studio={editingStudio}
          onUpdate={(updates) => updateStudio(editingStudio.id, updates)}
          onClose={() => setEditingId(null)}
          onDelete={() => handleDeleteStudio(editingStudio.id)}
        />
      )}
    </div>
  );
}
