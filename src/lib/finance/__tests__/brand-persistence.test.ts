import { describe, it, expect } from "vitest";
import { BrandItemSchema } from "../schemas";

describe("Brand item persistence shape", () => {
  it("round-trips note through JSON storage", () => {
    const note = BrandItemSchema.parse({
      id: "brand-1",
      type: "note",
      title: "Tone of voice",
      description: "Warm, direct, never salesy.",
      tags: ["voice"],
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const raw = JSON.stringify({ brandItems: [note] });
    const parsed = JSON.parse(raw) as { brandItems: unknown[] };
    const restored = BrandItemSchema.parse(parsed.brandItems[0]);

    expect(restored.title).toBe("Tone of voice");
    expect(restored.description).toBe("Warm, direct, never salesy.");
    expect(restored.status).toBe("active");
  });

  it("round-trips link with source URL", () => {
    const link = BrandItemSchema.parse({
      id: "brand-2",
      type: "link",
      title: "Reference studio",
      sourceUrl: "https://example.com/studio",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const restored = BrandItemSchema.parse(JSON.parse(JSON.stringify(link)));
    expect(restored.sourceUrl).toBe("https://example.com/studio");
  });
});
