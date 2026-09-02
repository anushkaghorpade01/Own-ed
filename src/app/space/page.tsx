"use client";

import { useState, useRef } from "react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SpaceImage } from "@/lib/finance/schemas";
import { Plus, Link as LinkIcon, Upload, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { persistenceService } from "@/lib/data/local/persistence-service";
import { useAssetUrl } from "@/hooks/use-asset-url";

const BOARDS = [
  "Overall Mood",
  "Flooring",
  "Mirrors",
  "Lighting",
  "Reformers",
  "Windows",
  "Materials",
  "Colour",
  "Reception",
  "Storage",
  "Bathroom",
  "Signage",
  "Furniture",
  "Details",
  "Floor Plan",
  "Other",
];

function newSpaceItem(
  board: string,
  partial: Partial<SpaceImage> & { itemType: SpaceImage["itemType"] }
): SpaceImage {
  const now = new Date().toISOString();
  return {
    id: `space-${Date.now()}`,
    board,
    category: board,
    title: partial.title,
    imageUrl: partial.imageUrl,
    sourceUrl: partial.sourceUrl,
    mimeType: partial.mimeType,
    itemType: partial.itemType,
    tags: partial.tags ?? [],
    notes: partial.notes,
    isSample: false,
    createdAt: now,
    updatedAt: now,
  };
}

export default function SpacePage() {
  const { state, addSpaceImage, updateSpaceImage, deleteSpaceImage } = useApp();
  const [activeBoard, setActiveBoard] = useState(BOARDS[0]);
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const boardItems = state.spaceImages.filter(
    (i) => i.board === activeBoard && !i.isSample
  );

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        toast.error(`Unsupported file type: ${file.type}`);
        continue;
      }
      const isPdf = file.type === "application/pdf";
      const isFloorPlan = activeBoard === "Floor Plan";
      const folderPath = isPdf
        ? `space/floor-plans/${file.name}`
        : isFloorPlan
          ? `space/floor-plans/${file.name}`
          : `space/uploads/${file.name}`;
      try {
        const asset = await persistenceService.uploadAsset(file, {
          filename: file.name,
          mimeType: file.type,
          category: isPdf || isFloorPlan ? "floor-plan" : "space-upload",
          folderPath,
          linkedEntityType: "space",
          linkedEntityId: activeBoard,
        });
        addSpaceImage(
          newSpaceItem(activeBoard, {
            itemType: isPdf ? "document" : "image",
            title: file.name,
            assetId: asset.assetId,
            mimeType: file.type,
            notes: isPdf ? "PDF document" : undefined,
          })
        );
        toast.success(`Added ${file.name}`);
      } catch {
        toast.error(`Could not save ${file.name}`);
      }
    }
    setShowAdd(false);
  };

  const handlePasteLink = () => {
    const url = prompt("Paste image or reference URL:");
    if (!url) return;
    addSpaceImage(
      newSpaceItem(activeBoard, {
        itemType: "link",
        title: url.replace(/^https?:\/\//, "").slice(0, 60),
        sourceUrl: url,
        imageUrl: url.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i) ? url : undefined,
      })
    );
    toast.success("Link added");
    setShowAdd(false);
  };

  const handleAddNote = () => {
    addSpaceImage(
      newSpaceItem(activeBoard, {
        itemType: "note",
        title: "Note",
        notes: "",
      })
    );
    setShowAdd(false);
  };

  return (
    <div>
      <SectionHeader
        title="Space"
        description="Your visual research and planning repository — real references you add, not generated filler."
        action={
          <Button type="button" size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="mr-1 h-4 w-4" /> Add to Space
          </Button>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {showAdd && (
        <div className="card-surface mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Upload from device
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePasteLink}>
            <LinkIcon className="mr-1 h-4 w-4" /> Paste a link
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleAddNote}>
            <StickyNote className="mr-1 h-4 w-4" /> Add note
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1">
        {BOARDS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setActiveBoard(b)}
            className={`rounded-md px-2 py-1 text-caption font-medium ${
              activeBoard === b
                ? "bg-[var(--text-primary)] text-white"
                : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {boardItems.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-body text-[var(--text-secondary)]">Nothing on this board yet.</p>
          <p className="text-body-sm mt-1 text-[var(--text-muted)]">
            Upload images, paste links, or add notes from your own research.
          </p>
          <Button type="button" className="mt-4" variant="outline" onClick={() => setShowAdd(true)}>
            Add your first reference
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boardItems.map((item) => (
            <SpaceItemCard
              key={item.id}
              item={item}
              onUpdate={(u) => updateSpaceImage(item.id, u)}
              onDelete={() => deleteSpaceImage(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SpaceItemCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: SpaceImage;
  onUpdate: (u: Partial<SpaceImage>) => void;
  onDelete: () => void;
}) {
  const displayUrl = useAssetUrl(item.assetId, item.imageUrl);

  return (
    <div className="card-surface">
      {displayUrl && item.itemType !== "note" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={item.title ?? ""} className="mb-2 max-h-48 w-full rounded object-cover" />
      )}
      {item.itemType === "link" && !displayUrl && (
        <div className="mb-2 rounded bg-[var(--surface-muted)] p-4 text-body-sm">
          <LinkIcon className="mb-1 h-4 w-4" />
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all underline">
            {item.sourceUrl}
          </a>
        </div>
      )}
      <Input value={item.title ?? ""} onChange={(e) => onUpdate({ title: e.target.value })} />
      <textarea
        className="mt-2 w-full rounded border border-[var(--border-default)] p-2 text-body-sm"
        rows={2}
        placeholder="Notes..."
        value={item.notes ?? ""}
        onChange={(e) => onUpdate({ notes: e.target.value })}
      />
      <button type="button" className="text-caption mt-2 text-red-600 hover:underline" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
