import type { GuideSection } from "./types";

export const workspaceSections: GuideSection[] = [
  {
    id: "space",
    title: "Space",
    category: "Workspace",
    keywords: ["space", "moodboard", "floor plan", "pictures", "images", "upload", "references"],
    aliases: ["pictures", "photos", "moodboards", "floor-plan"],
    body: [
      "Store visual references for the physical studio — moodboards by board (flooring, lighting, reformers, etc.), floor plans, uploaded images, pasted links, and notes.",
      "Uploads save locally on your device. Images are stored as files in your browser; you can optionally mirror them to an Own-ed folder in Settings → Data.",
    ],
    payAttention: [
      "Links stay as URLs unless you explicitly save a local copy.",
      "No auto-generated imagery — only what you upload or paste.",
    ],
    related: [{ id: "saving", label: "Saving & backups" }],
  },
  {
    id: "brand",
    title: "Brand",
    category: "Workspace",
    keywords: ["brand", "logo", "copy", "references", "images", "principles", "naming"],
    aliases: ["pictures", "brand identity"],
    body: [
      "Working repository for brand references, copy phrases, naming ideas, principles, uploaded images/PDFs, and links.",
      "Add via grid: notes, uploads, links, or structured types. Archive when done exploring.",
    ],
    related: [{ id: "saving", label: "Saving & backups" }],
  },
  {
    id: "studios",
    title: "Studios",
    category: "Workspace",
    keywords: ["studios", "competitor", "research", "benchmark", "visited", "pricing"],
    aliases: ["competitors", "studio research"],
    body: [
      "Record competitor and inspiration studios — location, pricing observed, packages, what worked, what did not, ratings, and notes.",
      "Informs your pricing and positioning; does not auto-feed the financial model.",
    ],
  },
  {
    id: "programming",
    title: "Programming",
    category: "Workspace",
    keywords: ["programming", "classes", "class types", "schedule", "curriculum"],
    aliases: ["class library"],
    body: [
      "Reference list of class types and programming ideas (group, private, standing spot concepts).",
      "Static catalog for now — link products to the financial model via Access Products and Assumptions.",
    ],
  },
  {
    id: "product",
    title: "Product",
    category: "Workspace",
    keywords: ["product", "concepts", "ideas", "features"],
    body: [
      "Capture product and service concepts beyond core reformer classes — workshops, retail, partnerships.",
      "Founder notes only; model other revenue separately in Assumptions if material.",
    ],
  },
  {
    id: "roadmap",
    title: "Roadmap",
    category: "Workspace",
    keywords: ["roadmap", "tasks", "timeline", "launch", "todo"],
    body: [
      "Launch and build tasks by phase — owner, deadline, status, notes.",
      "Separate from Math; use for execution tracking.",
    ],
  },
  {
    id: "library",
    title: "Library",
    category: "Workspace",
    keywords: ["library", "notes", "links", "research", "search"],
    body: [
      "Catch-all searchable notes and links across the project. Quick-add from the library page or find items via ⌘K global search.",
    ],
  },
];
