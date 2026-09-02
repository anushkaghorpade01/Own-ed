import type {
  FinanceAssumptions,
  Product,
  ProductVersionSnapshot,
  Scenario,
  Snapshot,
  Decision,
  Studio,
  LibraryItem,
} from "@/lib/finance/schemas";
import type {
  NormalizedAppData,
  ConnectionStatus,
  SyncResult,
  OwnedBackupV1,
  Conflict,
  CreditLedgerEvent,
  PackCohortRecord,
  ActualRecord,
  OpenQuestionRecord,
  RoadmapRecord,
  ProgrammingRecord,
  BrandRecord,
  VendorRecord,
  AssetRecord,
  PendingWrite,
  MigrationFlag,
  LegacyAppState,
} from "./types";

export interface StructuredDataRepository {
  connect(config: { sheetId: string; driveFolderId: string }): Promise<void>;
  getConnectionStatus(): Promise<ConnectionStatus>;

  loadAll(): Promise<NormalizedAppData>;
  saveAll(data: NormalizedAppData): Promise<SyncResult>;

  getLiveAssumptions(): Promise<FinanceAssumptions>;
  saveAssumptions(assumptions: FinanceAssumptions): Promise<void>;

  listProducts(filters?: { lifecycle?: string[] }): Promise<Product[]>;
  saveProduct(product: Product, options?: { bumpVersion?: boolean }): Promise<void>;
  getProductVersionHistory(productId: string): Promise<ProductVersionSnapshot[]>;

  listScenarios(): Promise<Scenario[]>;
  saveScenario(scenario: Scenario): Promise<void>;
  listSnapshots(): Promise<Snapshot[]>;
  saveSnapshot(snapshot: Snapshot): Promise<void>;

  appendLedgerEvents(events: CreditLedgerEvent[]): Promise<void>;
  listLedgerEvents(filter?: { productId?: string; since?: string }): Promise<CreditLedgerEvent[]>;
  listPackCohorts(filter?: { productId?: string }): Promise<PackCohortRecord[]>;
  upsertPackCohorts(cohorts: PackCohortRecord[]): Promise<void>;

  listActuals(filter?: { productId?: string; periodStart?: string }): Promise<ActualRecord[]>;
  upsertActuals(records: ActualRecord[]): Promise<void>;

  listStudios(): Promise<Studio[]>;
  saveStudio(studio: Studio): Promise<void>;
  listDecisions(): Promise<Decision[]>;
  saveDecision(decision: Decision): Promise<void>;
  listLibraryItems(): Promise<LibraryItem[]>;
  saveLibraryItem(item: LibraryItem): Promise<void>;

  listOpenQuestions(): Promise<OpenQuestionRecord[]>;
  saveOpenQuestion(question: OpenQuestionRecord): Promise<void>;
  listRoadmap(): Promise<RoadmapRecord[]>;
  saveRoadmapItem(item: RoadmapRecord): Promise<void>;
  listProgramming(): Promise<ProgrammingRecord[]>;
  saveProgrammingItem(item: ProgrammingRecord): Promise<void>;
  listBrand(): Promise<BrandRecord[]>;
  saveBrandItem(item: BrandRecord): Promise<void>;
  listVendors(): Promise<VendorRecord[]>;
  saveVendor(vendor: VendorRecord): Promise<void>;

  syncNow(): Promise<SyncResult>;
  exportStructuredBackup(): Promise<OwnedBackupV1>;
  importStructuredBackup(backup: OwnedBackupV1): Promise<void>;

  resolveConflict<T>(conflict: Conflict<T>, resolution: "local" | "remote"): Promise<void>;

  /** Migrate legacy localStorage blob to normalized shape */
  migrateFromLegacy(legacy: LegacyAppState): Promise<{
    data: NormalizedAppData;
    flags: MigrationFlag[];
  }>;
}

export interface AssetUploadMeta {
  filename: string;
  mimeType: string;
  category: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sourceUrl?: string;
  notes?: string;
  tags?: string[];
  folderPath?: string;
}

export interface AssetStorageRepository {
  upload(file: Blob, meta: AssetUploadMeta): Promise<AssetRecord>;
  getDownloadUrl(assetId: string): Promise<string>;
  openInDrive(assetId: string): Promise<string>;
  replace(assetId: string, file: Blob): Promise<AssetRecord>;
  unlink(assetId: string): Promise<void>;
  trash(assetId: string): Promise<void>;
  listAssets(filter?: { linkedEntityType?: string; linkedEntityId?: string }): Promise<AssetRecord[]>;
}

export interface SyncQueueRepository {
  enqueue(op: PendingWrite): Promise<void>;
  listPending(): Promise<PendingWrite[]>;
  markSynced(ids: string[]): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
  flush(structuredRepo: StructuredDataRepository): Promise<SyncResult>;
}

export { type NormalizedAppData, type MigrationFlag, type LegacyAppState };
