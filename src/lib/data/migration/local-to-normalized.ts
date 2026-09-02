/**
 * Migrates legacy localStorage AppState blob → normalized data shape.
 * Preserves compatible values; flags unmappable fields.
 */
import { v4 as uuidv4 } from "uuid";
import type { FinanceAssumptions, Product, OpenQuestion, NextAction, ProductVersionSnapshot, RoadmapItem } from "@/lib/finance/schemas";
import { normalizeAssumptions } from "@/lib/finance/validation";
import { ensureProductVersionFields } from "@/lib/finance/engine/product-catalog";
import { createSampleAssumptions } from "@/lib/finance/sample-data";
import type {
  LegacyAppState,
  NormalizedAppData,
  MigrationFlag,
  OpenQuestionRecord,
  RoadmapRecord,
  SettingsRecord,
  AssumptionsRecord,
  PackRulesRecord,
  StandingProductRecord,
  StandingReservationRecord,
  StandbyProductRecord,
  ScheduleRecord,
  AssetRecord,
} from "../types";

const SCHEMA_VERSION = 1;

function newId(prefix: string): string {
  return `${prefix}-${uuidv4()}`;
}

function mapOpenQuestionStatus(
  status: OpenQuestion["status"]
): OpenQuestionRecord["status"] {
  if (status === "resolved") return "resolved";
  if (status === "deferred") return "parked";
  return "open";
}

function extractStandingReservations(product: Product): StandingReservationRecord[] {
  const slots = product.standingSpotRules?.recurringSlots ?? [];
  const versionId = product.versionId ?? "unknown";
  const now = new Date().toISOString();
  return slots.map((slot) => ({
    id: newId("standing-res"),
    productId: product.id,
    productVersionId: versionId,
    dayOfWeek: slot.day,
    startTime: slot.startTime,
    expectedFlexibleFillProbabilityPct: slot.expectedFlexibleFillProbabilityPct,
    createdAt: now,
    updatedAt: now,
  }));
}

function productToPackRules(product: Product): PackRulesRecord | null {
  if (!product.packRules) return null;
  const now = new Date().toISOString();
  return {
    id: newId("pack-rules"),
    productId: product.id,
    productVersionId: product.versionId ?? "unknown",
    rules: product.packRules,
    createdAt: now,
    updatedAt: now,
  };
}

function productToStanding(product: Product): StandingProductRecord | null {
  if (product.type !== "standing_spot") return null;
  const now = new Date().toISOString();
  return {
    id: newId("standing-prod"),
    productId: product.id,
    productVersionId: product.versionId ?? "unknown",
    data: {
      standingSpotClassesPerWeek: product.standingSpotClassesPerWeek,
      standingSpotClassesPerMonth: product.standingSpotClassesPerMonth,
      standingSpotSeatsPerClass: product.standingSpotSeatsPerClass,
      standingSpotMinCommitmentMonths: product.standingSpotMinCommitmentMonths,
      standingSpotRecurringSubscription: product.standingSpotRecurringSubscription,
      standingSpotReservedDay: product.standingSpotReservedDay,
      standingSpotReservedTime: product.standingSpotReservedTime,
      standingSpotCancellationPolicy: product.standingSpotCancellationPolicy,
      standingSpotPausePolicy: product.standingSpotPausePolicy,
      standingSpotMissedClassPolicy: product.standingSpotMissedClassPolicy,
      standingSpotMakeUpEligible: product.standingSpotMakeUpEligible,
      standingSpotAutoRenew: product.standingSpotAutoRenew,
      standingSpotMemberAttendanceProbabilityPct:
        product.standingSpotMemberAttendanceProbabilityPct,
      standingSpotComparableProductId: product.standingSpotComparableProductId,
      standingSpotRules: product.standingSpotRules,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function productToStandby(product: Product): StandbyProductRecord | null {
  if (product.type !== "standby") return null;
  const now = new Date().toISOString();
  return {
    id: newId("standby-prod"),
    productId: product.id,
    productVersionId: product.versionId ?? "unknown",
    data: {
      standbyReleaseHoursBefore: product.standbyReleaseHoursBefore,
      standbyCannibalisationPct: product.standbyCannibalisationPct,
      maxUsesPerMonth: product.maxUsesPerMonth,
      standbyExpectedAvailableEmptySeats: product.standbyExpectedAvailableEmptySeats,
      standbyExpectedClaimRatePct: product.standbyExpectedClaimRatePct,
      standbyAttendanceRatePct: product.standbyAttendanceRatePct,
      classEligibility: product.classEligibility,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function migrateLegacyAppState(legacy: LegacyAppState): {
  data: NormalizedAppData;
  flags: MigrationFlag[];
} {
  const flags: MigrationFlag[] = [];
  const now = new Date().toISOString();
  const defaults = createSampleAssumptions();

  const rawAssumptions = legacy.assumptions ?? defaults;
  const assumptions = normalizeAssumptions(rawAssumptions, defaults);
  const { products, ...assumptionScalars } = assumptions;

  const normalizedProducts = products.map((p) => ensureProductVersionFields(p));

  const productVersions = Object.entries(
    (legacy.productVersionHistory ?? {}) as Record<string, ProductVersionSnapshot[]>
  ).flatMap(([productId, versions]) =>
    versions.map((v: ProductVersionSnapshot) => ({
        ...v,
        product: ensureProductVersionFields(v.product),
        note: v.note ?? `Historical version for ${productId}`,
      }))
  );

  const packRules: PackRulesRecord[] = [];
  const standingProducts: StandingProductRecord[] = [];
  const standingReservations: StandingReservationRecord[] = [];
  const standbyProducts: StandbyProductRecord[] = [];

  for (const product of normalizedProducts) {
    const rules = productToPackRules(product);
    if (rules) packRules.push(rules);
    const standing = productToStanding(product);
    if (standing) standingProducts.push(standing);
    standingReservations.push(...extractStandingReservations(product));
    const standby = productToStandby(product);
    if (standby) standbyProducts.push(standby);

    if (product.expectedMonthlyUsageCredits != null) {
      flags.push({
        entity: `product:${product.id}`,
        field: "expectedMonthlyUsageCredits",
        message: "Deprecated monthly usage field cleared — use packRules redemption curves.",
        severity: "info",
      });
    }
  }

  const schedule: ScheduleRecord[] = (assumptions.schedule ?? []).map((entry) => ({
    id: entry.id,
    assumptionsId: assumptions.id,
    entry,
    createdAt: now,
    updatedAt: now,
  }));

  const openQuestions: OpenQuestionRecord[] = (legacy.questions ?? []).map((q) => ({
    id: q.id,
    question: q.question,
    context: q.context,
    status: mapOpenQuestionStatus(q.status),
    createdAt: q.createdAt,
    updatedAt: q.createdAt,
  }));

  const roadmap: RoadmapRecord[] =
    (legacy.roadmapItems ?? []).length > 0
      ? legacy.roadmapItems!.map((item: RoadmapItem) => ({
          id: item.id,
          title: item.title,
          phase: item.phase,
          status: item.status,
          priority: item.priority,
          owner: item.owner,
          deadline: item.deadline,
          notes: item.notes,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }))
      : (legacy.actions ?? []).map((a: NextAction) => ({
          id: a.id,
          title: a.title,
          phase: "Unassigned",
          status: a.completed ? "Done" : "Todo",
          priority: "Medium",
          deadline: a.dueDate,
          notes: a.link ? `Link: ${a.link}` : undefined,
          createdAt: a.createdAt,
          updatedAt: a.createdAt,
        }));

  if ((legacy.roadmapItems ?? []).length > 0) {
    flags.push({
      entity: "roadmapItems",
      message: `${legacy.roadmapItems!.length} roadmap item(s) synced to Roadmap tab.`,
      severity: "info",
    });
  } else if ((legacy.actions ?? []).length > 0) {
    flags.push({
      entity: "actions",
      message: `${legacy.actions!.length} legacy action(s) migrated to Roadmap tab.`,
      severity: "info",
    });
  }

  const assets: AssetRecord[] = (legacy.spaceImages ?? []).map((img) => ({
    assetId: img.id,
    filename: img.title ?? `moodboard-${img.id}`,
    category: "moodboard",
    linkedEntityType: "space_board",
    linkedEntityId: img.board,
    sourceUrl: img.sourceUrl ?? img.imageUrl,
    notes: img.notes,
    tags: img.tags,
    createdAt: img.createdAt,
    updatedAt: img.createdAt,
  }));

  for (const img of legacy.spaceImages ?? []) {
    if (img.imageUrl?.startsWith("https://picsum.photos")) {
      flags.push({
        entity: `space_image:${img.id}`,
        field: "imageUrl",
        message: "Placeholder picsum URL preserved — re-upload to Drive when connected.",
        severity: "warning",
      });
    }
  }

  if (!legacy.assumptions) {
    flags.push({
      entity: "assumptions",
      message: "No legacy assumptions found — sample defaults used.",
      severity: "warning",
    });
  }

  const settings: SettingsRecord = {
    id: "settings-main",
    schemaVersion: SCHEMA_VERSION,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const assumptionsRecord: AssumptionsRecord = {
    id: assumptions.id,
    name: assumptions.name,
    isLive: true,
    isSample: assumptions.isSample ?? false,
    data: assumptionScalars as Omit<FinanceAssumptions, "products">,
    createdAt: assumptions.updatedAt ?? now,
    updatedAt: assumptions.updatedAt ?? now,
  };

  return {
    data: {
      settings,
      assumptions: assumptionsRecord,
      products: normalizedProducts,
      productVersions,
      packRules,
      standingProducts,
      standingReservations,
      standbyProducts,
      schedule,
      scenarios: legacy.scenarios ?? [],
      scenarioSnapshots: legacy.snapshots ?? [],
      packCohorts: [],
      creditLedger: [],
      actuals: [],
      studios: legacy.studios ?? [],
      openQuestions,
      decisions: legacy.decisions ?? [],
      roadmap,
      programming: [],
      brand: (legacy.brandItems ?? []).map((item) => ({
        id: item.id,
        category: item.type,
        title: item.title,
        content: item.description,
        assetId: item.assetId,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
      vendors: [],
      library: legacy.libraryItems ?? [],
      assets,
    },
    flags,
  };
}

/** Reassemble FinanceAssumptions from normalized records for engine use */
export function assembleFinanceAssumptions(
  record: AssumptionsRecord,
  products: Product[]
): FinanceAssumptions {
  return normalizeAssumptions(
    { ...record.data, products, id: record.id, name: record.name, isSample: record.isSample },
    createSampleAssumptions()
  );
}

export function denormalizeToLegacyShape(data: NormalizedAppData): LegacyAppState {
  const assumptions = assembleFinanceAssumptions(data.assumptions, data.products);
  const productVersionHistory: Record<string, import("@/lib/finance/schemas").ProductVersionSnapshot[]> =
    {};
  for (const v of data.productVersions) {
    const pid = v.product.id;
    productVersionHistory[pid] = [...(productVersionHistory[pid] ?? []), v];
  }

  return {
    assumptions,
    decisions: data.decisions,
    questions: data.openQuestions.map((q) => ({
      id: q.id,
      question: q.question,
      context: q.context,
      status:
        q.status === "resolved"
          ? "resolved"
          : q.status === "parked"
            ? "deferred"
            : "open",
      createdAt: q.createdAt,
    })),
    actions: data.roadmap.map((r) => ({
      id: r.id,
      title: r.title,
      dueDate: r.deadline,
      completed: r.status.toLowerCase() === "done",
      link: undefined,
      createdAt: r.createdAt,
    })),
    roadmapItems: data.roadmap.map((r) => ({
      id: r.id,
      title: r.title,
      phase: r.phase,
      status:
        r.status === "Done"
          ? "Done"
          : r.status === "In progress"
            ? "In progress"
            : r.status === "Blocked"
              ? "Blocked"
              : "Todo",
      priority:
        r.priority === "High" ? "High" : r.priority === "Low" ? "Low" : "Medium",
      owner: r.owner,
      deadline: r.deadline,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    studios: data.studios,
    spaceImages: data.assets
      .filter((a) => a.category === "moodboard")
      .map((a) => ({
        id: a.assetId,
        board: a.linkedEntityId ?? "Overall",
        title: a.filename,
        imageUrl: a.sourceUrl ?? "",
        sourceUrl: a.sourceUrl,
        itemType: a.mimeType?.startsWith("image/") ? ("image" as const) : a.sourceUrl ? ("link" as const) : ("note" as const),
        tags: a.tags,
        notes: a.notes,
        isSample: false,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    libraryItems: data.library,
    scenarios: data.scenarios,
    snapshots: data.scenarioSnapshots,
    productVersionHistory,
  };
}
