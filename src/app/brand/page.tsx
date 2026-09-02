"use client";

import { useState, useRef } from "react";
import { useApp } from "@/lib/store/app-store";
import { SectionHeader } from "@/components/shared/metric-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BrandItem } from "@/lib/finance/schemas";
import { cn } from "@/lib/cn";
import { Plus, Grid, List, ExternalLink } from "lucide-react";
import { persistenceService } from "@/lib/data/local/persistence-service";
import { useAssetUrl } from "@/hooks/use-asset-url";
import {
  isSiteSharedBrandItem,
  SITE_SHARED_BRAND_ITEMS,
} from "@/lib/finance/site-shared-brand";
import { Badge } from "@/components/ui/badge";

const ADD_TYPES: Array<{ type: BrandItem["type"]; label: string }> = [
  { type: "note", label: "Write a note" },
  { type: "image", label: "Upload image / file" },
  { type: "link", label: "Paste a link" },
  { type: "reference", label: "Add reference" },
  { type: "brand_principle", label: "Brand decision" },
  { type: "copy_phrase", label: "Copy / phrase" },
  { type: "naming_idea", label: "Naming idea" },
  { type: "idea", label: "Idea" },
];

function newBrandItem(type: BrandItem["type"], partial?: Partial<BrandItem>): BrandItem {
  const now = new Date().toISOString();
  return {
    id: `brand-${Date.now()}`,
    type,
    title: partial?.title ?? "Untitled",
    description: partial?.description,
    tags: partial?.tags ?? [],
    sourceUrl: partial?.sourceUrl,
    imageUrl: partial?.imageUrl,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export default function BrandPage() {
  const { state, addBrandItem, updateBrandItem, deleteBrandItem, archiveBrandItem } = useApp();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const items = [
    ...SITE_SHARED_BRAND_ITEMS,
    ...state.brandItems.filter((i) => i.status === "active"),
  ];

  const handleAddType = (type: BrandItem["type"]) => {
    if (type === "image") {
      fileRef.current?.click();
      setShowAdd(false);
      return;
    }
    if (type === "link") {
      const url = prompt("Paste link URL:");
      if (url) {
        addBrandItem(newBrandItem("link", { title: url, sourceUrl: url }));
      }
      setShowAdd(false);
      return;
    }
    addBrandItem(newBrandItem(type));
    setShowAdd(false);
  };

  const handleFile = async (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const isImage = file.type.startsWith("image/");
    const folderPath = isImage ? `brand/images/${file.name}` : `brand/documents/${file.name}`;
    try {
      const asset = await persistenceService.uploadAsset(file, {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        category: isImage ? "brand-image" : "brand-document",
        folderPath,
        linkedEntityType: "brand",
      });
      addBrandItem(
        newBrandItem("image", {
          title: file.name,
          assetId: asset.assetId,
          description: `Uploaded ${file.type || "file"}`,
        })
      );
    } catch {
      addBrandItem(
        newBrandItem("image", {
          title: file.name,
          description: "Upload failed — try again",
        })
      );
    }
  };

  return (
    <div>
      <SectionHeader
        title="Brand"
        description="Store, organise, and decide — your brand references, copy, and principles."
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setView(view === "grid" ? "list" : "grid")}
            >
              {view === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
            </Button>
            <Button type="button" size="sm" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />

      {showAdd && (
        <div className="card-surface mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ADD_TYPES.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAddType(type)}
              className="rounded-lg border border-[var(--border-default)] px-3 py-2 text-left text-body-sm hover:bg-[var(--surface-muted)]"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card-surface py-16 text-center">
          <p className="text-body text-[var(--text-secondary)]">Nothing here yet.</p>
          <Button type="button" className="mt-4" onClick={() => setShowAdd(true)}>
            + Add your first brand reference
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <BrandCard
              key={item.id}
              item={item}
              readOnly={isSiteSharedBrandItem(item.id)}
              onUpdate={(u) => updateBrandItem(item.id, u)}
              onDelete={() => deleteBrandItem(item.id)}
              onArchive={() => archiveBrandItem(item.id, true)}
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const readOnly = isSiteSharedBrandItem(item.id);
            return (
            <li key={item.id} className="card-surface flex items-start justify-between gap-3">
              <div>
                {readOnly && (
                  <Badge variant="secondary" className="mb-1 text-[10px]">
                    Shared workspace
                  </Badge>
                )}
                <p className="text-body font-medium">{item.title}</p>
                <p className="text-caption uppercase">{item.type.replace(/_/g, " ")}</p>
                {item.description && (
                  <p className="text-body-sm mt-1 text-[var(--text-secondary)]">{item.description}</p>
                )}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-caption mt-1 inline-flex items-center gap-1 text-[var(--accent)] underline"
                  >
                    Open in Notion
                    <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </div>
              {!readOnly && (
                <ItemActions
                  onDelete={() => deleteBrandItem(item.id)}
                  onArchive={() => archiveBrandItem(item.id, true)}
                />
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function BrandCard({
  item,
  readOnly,
  onUpdate,
  onDelete,
  onArchive,
}: {
  item: BrandItem;
  readOnly?: boolean;
  onUpdate: (u: Partial<BrandItem>) => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const displayUrl = useAssetUrl(item.assetId, item.imageUrl);

  return (
    <div className="card-surface">
      {readOnly && (
        <Badge variant="secondary" className="mb-2 text-[10px]">
          Shared workspace
        </Badge>
      )}
      {displayUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={item.title} className="mb-2 max-h-40 w-full rounded object-cover" />
      )}
      {readOnly ? (
        <>
          <p className="text-body font-medium text-[#2C2825]">{item.title}</p>
          <p className="text-caption mt-1 uppercase">{item.type.replace(/_/g, " ")}</p>
          {item.description && (
            <p className="mt-2 text-body-sm text-[var(--text-secondary)]">{item.description}</p>
          )}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] underline"
            >
              Open in Notion
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </>
      ) : (
        <>
      <Input
        value={item.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        className="text-body font-medium"
      />
      <p className="text-caption mt-1 uppercase">{item.type.replace(/_/g, " ")}</p>
      <textarea
        className="mt-2 w-full rounded border border-[var(--border-default)] p-2 text-body-sm"
        rows={3}
        placeholder="Notes..."
        value={item.description ?? ""}
        onChange={(e) => onUpdate({ description: e.target.value })}
      />
      {item.sourceUrl && (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-caption mt-1 block truncate text-[var(--accent)]"
        >
          {item.sourceUrl}
        </a>
      )}
      <div className="mt-2">
        <ItemActions onDelete={onDelete} onArchive={onArchive} />
      </div>
        </>
      )}
    </div>
  );
}

function ItemActions({ onDelete, onArchive }: { onDelete: () => void; onArchive: () => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" className="text-caption text-[var(--text-muted)] hover:underline" onClick={onArchive}>
        Archive
      </button>
      <button type="button" className="text-caption text-red-600 hover:underline" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
