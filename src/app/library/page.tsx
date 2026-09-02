"use client";

import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";

export default function LibraryPage() {
  const { state, addLibraryItem } = useApp();
  const [query, setQuery] = useState("");
  const [quickTitle, setQuickTitle] = useState("");

  const filtered = state.libraryItems.filter(
    (item) =>
      !query ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    addLibraryItem({
      id: `lib-${Date.now()}`,
      type: "note",
      title: quickTitle,
      assignedTo: "unassigned",
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setQuickTitle("");
  };

  return (
    <div>
      <SectionHeader
        title="Library"
        description="Universal founder inbox — save ideas, links, notes, and assign later."
      />

      <div className="mb-6 flex gap-3">
        <Input
          placeholder="Search everything…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
        <Input
          placeholder="Quick add note…"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          className="max-w-md"
        />
        <Button onClick={handleQuickAdd}>Add</Button>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.type}</Badge>
                  <Badge variant="secondary">{item.assignedTo}</Badge>
                </div>
                <p className="mt-1 font-medium text-[#2C2825]">{item.title}</p>
                {item.content && <p className="text-sm text-[#6B6560]">{item.content}</p>}
              </div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#C4A882]">
                  Open →
                </a>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
