import type {
  FinanceAssumptions,
  Product,
  ProductVersionSnapshot,
  Scenario,
  Snapshot,
  Decision,
  OpenQuestion,
  Studio,
  SpaceImage,
  LibraryItem,
  BrandItem,
  MathReviewItem,
  ProductConcept,
  ProgrammingItem,
} from "@/lib/finance/schemas";

export type SyncStatus = "saved" | "saving" | "pending" | "offline" | "error";

export interface SyncMeta {
  id: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  remoteUpdatedAt?: string;
}

export interface Conflict<T> {
  local: T;
  remote: T;
  entityType: string;
  entityId: string;
}

export interface ConnectionStatus {
  connected: boolean;
  googleAccountEmail?: string;
  sheetId?: string;
  driveFolderId?: string;
  lastSyncAt?: string;
  syncStatus: SyncStatus;
  pendingWriteCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  entitiesWritten: number;
  errors: string[];
}

export interface OwnedBackupV1 {
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  data: NormalizedAppData;
  assetMetadata: AssetRecord[];
}

/** Normalized application data — canonical shape for Sheets + backup */
export type LocalSaveStatus = "idle" | "saving" | "saved" | "error";

export interface LocalPersistenceStats {
  recordCount: number;
  assetCount: number;
  lastLocalSaveAt?: string;
  folderConnected: boolean;
  folderName?: string;
  lastFolderSyncAt?: string;
  schemaVersion: number;
}

/** Full IndexedDB payload — normalized data + AppState extensions */
export interface LocalDbPayload {
  schemaVersion: number;
  normalized: NormalizedAppData;
  extensions: {
    mathReviewItems: MathReviewItem[];
    productConcepts: ProductConcept[];
    programmingItems: ProgrammingItem[];
    brandItems: BrandItem[];
    spaceImages: SpaceImage[];
    productVersionHistory: Record<string, ProductVersionSnapshot[]>;
  };
  savedAt: string;
}

export interface NormalizedAppData {
  settings: SettingsRecord;
  assumptions: AssumptionsRecord;
  products: Product[];
  productVersions: ProductVersionSnapshot[];
  packRules: PackRulesRecord[];
  standingProducts: StandingProductRecord[];
  standingReservations: StandingReservationRecord[];
  standbyProducts: StandbyProductRecord[];
  schedule: ScheduleRecord[];
  scenarios: Scenario[];
  scenarioSnapshots: Snapshot[];
  packCohorts: PackCohortRecord[];
  creditLedger: CreditLedgerEvent[];
  actuals: ActualRecord[];
  studios: Studio[];
  openQuestions: OpenQuestionRecord[];
  decisions: Decision[];
  roadmap: RoadmapRecord[];
  programming: ProgrammingRecord[];
  brand: BrandRecord[];
  vendors: VendorRecord[];
  library: LibraryItem[];
  assets: AssetRecord[];
}

export interface SettingsRecord {
  id: string;
  connectedSheetId?: string;
  connectedDriveFolderId?: string;
  googleAccountEmail?: string;
  schemaVersion: number;
  lastSyncAt?: string;
  syncStatus: SyncStatus;
  engineVersion?: string;
  formulaVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssumptionsRecord {
  id: string;
  name: string;
  isLive: boolean;
  isSample: boolean;
  /** Scalar fields only — products live in Products tab */
  data: Omit<FinanceAssumptions, "products">;
  createdAt: string;
  updatedAt: string;
}

export interface PackRulesRecord {
  id: string;
  productId: string;
  productVersionId: string;
  rules: NonNullable<Product["packRules"]>;
  createdAt: string;
  updatedAt: string;
}

export interface StandingProductRecord {
  id: string;
  productId: string;
  productVersionId: string;
  data: Pick<
    Product,
    | "standingSpotClassesPerWeek"
    | "standingSpotClassesPerMonth"
    | "standingSpotSeatsPerClass"
    | "standingSpotMinCommitmentMonths"
    | "standingSpotRecurringSubscription"
    | "standingSpotReservedDay"
    | "standingSpotReservedTime"
    | "standingSpotCancellationPolicy"
    | "standingSpotPausePolicy"
    | "standingSpotMissedClassPolicy"
    | "standingSpotMakeUpEligible"
    | "standingSpotAutoRenew"
    | "standingSpotMemberAttendanceProbabilityPct"
    | "standingSpotComparableProductId"
    | "standingSpotRules"
  >;
  createdAt: string;
  updatedAt: string;
}

export interface StandingReservationRecord {
  id: string;
  productId: string;
  productVersionId: string;
  dayOfWeek: string;
  startTime: string;
  classId?: string;
  expectedFlexibleFillProbabilityPct?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StandbyProductRecord {
  id: string;
  productId: string;
  productVersionId: string;
  data: Pick<
    Product,
    | "standbyReleaseHoursBefore"
    | "standbyCannibalisationPct"
    | "maxUsesPerMonth"
    | "standbyExpectedAvailableEmptySeats"
    | "standbyExpectedClaimRatePct"
    | "standbyAttendanceRatePct"
    | "classEligibility"
  >;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRecord {
  id: string;
  assumptionsId: string;
  entry: FinanceAssumptions["schedule"][number];
  createdAt: string;
  updatedAt: string;
}

export interface PackCohortRecord {
  id: string;
  productId: string;
  productVersionId: string;
  purchasePeriod: string;
  activationPeriod?: string;
  expiryPeriod?: string;
  creditsSold: number;
  creditsRedeemed: number;
  creditsExpired: number;
  creditsRemaining: number;
  cashCollected: number;
  earnedRevenue: number;
  deferredRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export type CreditLedgerEventType =
  | "PACK_PURCHASED"
  | "CREDIT_REDEEMED"
  | "CREDIT_RETURNED"
  | "CREDIT_FORFEITED"
  | "CREDIT_EXPIRED"
  | "MANUAL_ADJUSTMENT";

export interface CreditLedgerEvent {
  id: string;
  eventType: CreditLedgerEventType;
  productId: string;
  productVersionId: string;
  cohortId?: string;
  customerRef?: string;
  creditsDelta: number;
  amountInr: number;
  eventAt: string;
  notes?: string;
  createdAt: string;
}

export interface ActualRecord {
  id: string;
  metricKey: string;
  productId?: string;
  productVersionId?: string;
  periodStart: string;
  periodEnd: string;
  assumedValue: number;
  actualValue?: number;
  forecastBasis: "assumed" | "actual" | "custom";
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpenQuestionRecord {
  id: string;
  question: string;
  category?: string;
  context?: string;
  status: "open" | "researching" | "resolved" | "parked";
  relatedEntityType?: string;
  relatedEntityId?: string;
  resolvedAt?: string;
  resolution?: string;
  convertedToDecisionId?: string;
  convertedToRoadmapId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapRecord {
  id: string;
  title: string;
  phase: string;
  status: string;
  priority: string;
  owner?: string;
  deadline?: string;
  cost?: number;
  dependency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgrammingRecord {
  id: string;
  name: string;
  classType?: string;
  durationMinutes?: number;
  linkedProductId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandRecord {
  id: string;
  category: string;
  title: string;
  content?: string;
  assetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  category?: string;
  contact?: string;
  notes?: string;
  assetId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  assetId: string;
  driveFileId?: string;
  driveFolderId?: string;
  filename: string;
  mimeType?: string;
  category: string;
  localBlobId?: string;
  filesystemRelativePath?: string;
  linkedEntityType?: string;
  linkedEntityId?: string;
  sourceUrl?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PendingWrite {
  id: string;
  entityType: string;
  entityId: string;
  operation: "create" | "update" | "delete";
  payload: unknown;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface MigrationFlag {
  entity: string;
  field?: string;
  message: string;
  severity: "info" | "warning" | "error";
}

/** Legacy localStorage blob shape */
export interface LegacyAppState {
  assumptions?: FinanceAssumptions;
  decisions?: Decision[];
  questions?: OpenQuestion[];
  actions?: import("@/lib/finance/schemas").NextAction[];
  mathReviewItems?: MathReviewItem[];
  roadmapItems?: import("@/lib/finance/schemas").RoadmapItem[];
  productConcepts?: ProductConcept[];
  brandItems?: BrandItem[];
  studios?: Studio[];
  spaceImages?: SpaceImage[];
  libraryItems?: LibraryItem[];
  scenarios?: Scenario[];
  snapshots?: Snapshot[];
  productVersionHistory?: Record<string, ProductVersionSnapshot[]>;
}
