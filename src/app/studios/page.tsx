"use client";

import { useApp } from "@/lib/store/app-store";
import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format/currency";
import { useState } from "react";

export default function StudiosPage() {
  const { state, addStudio } = useApp();
  const [compare, setCompare] = useState<string[]>([]);

  const toggleCompare = (id: string) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const compared = state.studios.filter((s) => compare.includes(s.id));

  return (
    <div>
      <SectionHeader
        title="Studios"
        description="Private competitor and studio intelligence database."
        action={
          <Button
            size="sm"
            onClick={() =>
              addStudio({
                id: `studio-${Date.now()}`,
                name: "New studio",
                location: "",
                visited: false,
                classFormats: [],
                packPrices: {},
                ratings: {},
                imageUrls: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Add studio
          </Button>
        }
      />
      <SampleBanner />

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
                      <th key={s.id} className="pb-2 pr-4">{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Drop-in</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">{s.dropInPrice ? formatINR(s.dropInPrice) : "—"}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Reformers</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">{s.reformers ?? "—"}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Class size</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">{s.maxClassSize ?? "—"}</td>
                    ))}
                  </tr>
                  <tr className="border-t border-[#FAF8F5]">
                    <td className="py-2 pr-4 text-[#6B6560]">Rating</td>
                    {compared.map((s) => (
                      <td key={s.id} className="py-2 pr-4">{s.personalRating ?? "—"}/10</td>
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
          <Card key={studio.id}>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{studio.name}</CardTitle>
                <p className="text-sm text-[#6B6560]">{studio.location}</p>
              </div>
              <div className="flex gap-2">
                {studio.visited && <Badge variant="success">Visited</Badge>}
                <button
                  type="button"
                  onClick={() => toggleCompare(studio.id)}
                  className={`text-xs ${compare.includes(studio.id) ? "text-[#2C2825] font-medium" : "text-[#A39E98]"}`}
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
                  <p className="text-[#6B6560]">{studio.liked}</p>
                </div>
              )}
              {studio.ownCouldLearn && (
                <div>
                  <p className="text-xs font-medium text-[#A39E98]">OWN could learn</p>
                  <p className="text-[#6B6560]">{studio.ownCouldLearn}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
