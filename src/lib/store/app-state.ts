/**
 * AppState shape — shared by store and persistence layers.
 */
import type {
  FinanceAssumptions,
  Decision,
  OpenQuestion,
  NextAction,
  Studio,
  SpaceImage,
  LibraryItem,
  BrandItem,
  RoadmapItem,
  ProductConcept,
  ProgrammingItem,
  Scenario,
  Snapshot,
  ProductVersionSnapshot,
} from "@/lib/finance/schemas";

export interface AppState {
  assumptions: FinanceAssumptions;
  decisions: Decision[];
  questions: OpenQuestion[];
  actions: NextAction[];
  roadmapItems: RoadmapItem[];
  productConcepts: ProductConcept[];
  programmingItems: ProgrammingItem[];
  studios: Studio[];
  spaceImages: SpaceImage[];
  brandItems: BrandItem[];
  libraryItems: LibraryItem[];
  scenarios: Scenario[];
  snapshots: Snapshot[];
  productVersionHistory: Record<string, ProductVersionSnapshot[]>;
  undoStack: Partial<AppState>[];
}
