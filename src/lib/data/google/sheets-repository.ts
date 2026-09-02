import type { StructuredDataRepository } from "../repositories";
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
  LegacyAppState,
  MigrationFlag,
  PackRulesRecord,
} from "../types";
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
import {
  migrateLegacyAppState,
  assembleFinanceAssumptions,
  denormalizeToLegacyShape,
} from "../migration/local-to-normalized";
import type { GoogleTokenSession } from "./session";
import {
  readSheetTab,
  replaceSheetTabData,
  rowFromRecord,
  findOrCreateSpreadsheet,
  findOrCreateDriveFolder,
  bootstrapSpreadsheetTabs,
} from "./sheets-client";
import type { SheetTabName } from "../tabs";
import { ENGINE_VERSION, FORMULA_VERSION } from "@/lib/finance/engine/scenarios";

function parseJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export class GoogleSheetsStructuredDataRepository implements StructuredDataRepository {
  constructor(
    private getSession: () => Promise<GoogleTokenSession>,
    private saveSession: (s: GoogleTokenSession) => Promise<void>
  ) {}

  async connect(_config: { sheetId: string; driveFolderId: string }): Promise<void> {
    const session = await this.getSession();
    await bootstrapSpreadsheetTabs(session, session.sheetId!);
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    try {
      const session = await this.getSession();
      return {
        connected: !!session.accessToken,
        googleAccountEmail: session.email,
        sheetId: session.sheetId,
        driveFolderId: session.driveFolderId,
        syncStatus: "saved",
        pendingWriteCount: 0,
      };
    } catch {
      return { connected: false, syncStatus: "offline", pendingWriteCount: 0 };
    }
  }

  async loadAll(): Promise<NormalizedAppData> {
    const session = await this.getSession();
    const sheetId = session.sheetId!;
    const { data } = await this.loadFromSheets(session, sheetId);
    return data;
  }

  private async loadFromSheets(
    session: GoogleTokenSession,
    sheetId: string
  ): Promise<{ data: NormalizedAppData; flags: MigrationFlag[] }> {
    const settingsRows = await readSheetTab(session, sheetId, "Settings");
    const assumptionsRows = await readSheetTab(session, sheetId, "Assumptions");
    const productRows = await readSheetTab(session, sheetId, "Products");
    const versionRows = await readSheetTab(session, sheetId, "ProductVersions");
    const scenarioRows = await readSheetTab(session, sheetId, "Scenarios");
    const snapshotRows = await readSheetTab(session, sheetId, "ScenarioSnapshots");
    const decisionRows = await readSheetTab(session, sheetId, "Decisions");
    const studioRows = await readSheetTab(session, sheetId, "Studios");
    const libraryRows = await readSheetTab(session, sheetId, "Library");
    const openQuestionRows = await readSheetTab(session, sheetId, "OpenQuestions");
    const roadmapRows = await readSheetTab(session, sheetId, "Roadmap");
    const programmingRows = await readSheetTab(session, sheetId, "Programming");
    const brandRows = await readSheetTab(session, sheetId, "Brand");
    const vendorRows = await readSheetTab(session, sheetId, "Vendors");
    const assetRows = await readSheetTab(session, sheetId, "Assets");
    const cohortRows = await readSheetTab(session, sheetId, "PackCohorts");
    const ledgerRows = await readSheetTab(session, sheetId, "CreditLedger");
    const actualRows = await readSheetTab(session, sheetId, "Actuals");
    const scheduleRows = await readSheetTab(session, sheetId, "Schedule");
    const packRulesRows = await readSheetTab(session, sheetId, "PackRules");

    const now = new Date().toISOString();
    const settings = settingsRows[0]
      ? {
          id: settingsRows[0].id,
          connectedSheetId: settingsRows[0].connected_sheet_id,
          connectedDriveFolderId: settingsRows[0].connected_drive_folder_id,
          googleAccountEmail: settingsRows[0].google_account_email,
          schemaVersion: Number(settingsRows[0].schema_version) || 1,
          lastSyncAt: settingsRows[0].last_sync_at,
          syncStatus: (settingsRows[0].sync_status as ConnectionStatus["syncStatus"]) ?? "saved",
          engineVersion: settingsRows[0].engine_version,
          formulaVersion: settingsRows[0].formula_version,
          createdAt: settingsRows[0].created_at || now,
          updatedAt: settingsRows[0].updated_at || now,
        }
      : {
          id: "settings-main",
          schemaVersion: 1,
          syncStatus: "saved" as const,
          createdAt: now,
          updatedAt: now,
        };

    const assumptionsRecord = assumptionsRows[0]
      ? {
          id: assumptionsRows[0].id,
          name: assumptionsRows[0].name,
          isLive: assumptionsRows[0].is_live === "true",
          isSample: assumptionsRows[0].is_sample === "true",
          data: parseJson(assumptionsRows[0].data_json, {} as Omit<FinanceAssumptions, "products">),
          createdAt: assumptionsRows[0].created_at || now,
          updatedAt: assumptionsRows[0].updated_at || now,
        }
      : {
          id: "live-assumptions",
          name: "Live Assumptions",
          isLive: true,
          isSample: false,
          data: {} as Omit<FinanceAssumptions, "products">,
          createdAt: now,
          updatedAt: now,
        };

    const products: Product[] = productRows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type as Product["type"],
      lifecycle: (r.lifecycle as Product["lifecycle"]) || "active",
      versionId: r.version_id,
      versionNumber: Number(r.version_number) || 1,
      price: Number(r.price) || 0,
      creditsIncluded: Number(r.credits_included) || 1,
      gstFollowsGlobal: r.gst_follows_global !== "false",
      gstTreatment: (r.gst_treatment as Product["gstTreatment"]) || "inclusive",
      packageMixPct: Number(r.package_mix_pct) || 0,
      peakEligible: r.peak_eligible !== "false",
      recurring: r.recurring === "true",
      discountPct: Number(r.discount_pct) || 0,
      classEligibility: parseJson(r.class_eligibility_json, []),
      standingSpotMaxSeatsPerClass: Number(r.standing_spot_max_seats_per_class) || 1,
      productCreatedAt: r.product_created_at,
      productUpdatedAt: r.product_updated_at,
      packRules: undefined,
    }));

    for (const pr of packRulesRows) {
      const product = products.find((p) => p.id === pr.product_id);
      if (product) {
        product.packRules = parseJson(pr.rules_json, undefined) as Product["packRules"];
      }
    }

    const productVersions: ProductVersionSnapshot[] = versionRows.map((r) => ({
      versionId: r.version_id,
      versionNumber: Number(r.version_number) || 1,
      product: parseJson(r.snapshot_json, {} as Product),
      createdAt: r.created_at || now,
      note: r.note,
    }));

    return {
      data: {
        settings,
        assumptions: assumptionsRecord,
        products,
        productVersions,
        packRules: packRulesRows.map((r) => ({
          id: r.id,
          productId: r.product_id,
          productVersionId: r.product_version_id,
          rules: parseJson(r.rules_json, {}) as PackRulesRecord["rules"],
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        standingProducts: [],
        standingReservations: [],
        standbyProducts: [],
        schedule: scheduleRows.map((r) => ({
          id: r.id,
          assumptionsId: r.assumptions_id,
          entry: parseJson(r.entry_json, {} as FinanceAssumptions["schedule"][number]),
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        scenarios: scenarioRows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          parentScenarioId: r.parent_scenario_id,
          isBaseCase: r.is_base_case === "true",
          assumptions: parseJson(r.assumptions_json, {} as FinanceAssumptions),
          timeline: parseJson(r.timeline_json, []),
          locked: r.locked === "true",
          archived: r.archived === "true",
          engineVersion: r.engine_version,
          formulaVersion: r.formula_version,
          storedOutputs: parseJson(r.stored_outputs_json, undefined),
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        scenarioSnapshots: snapshotRows.map((r) => ({
          id: r.id,
          name: r.name,
          notes: r.notes,
          assumptions: parseJson(r.assumptions_json, {} as FinanceAssumptions),
          outputs: parseJson(r.outputs_json, {}),
          createdAt: r.created_at || now,
          immutable: true,
        })),
        packCohorts: cohortRows.map((r) => ({
          id: r.id,
          productId: r.product_id,
          productVersionId: r.product_version_id,
          purchasePeriod: r.purchase_period,
          activationPeriod: r.activation_period,
          expiryPeriod: r.expiry_period,
          creditsSold: Number(r.credits_sold) || 0,
          creditsRedeemed: Number(r.credits_redeemed) || 0,
          creditsExpired: Number(r.credits_expired) || 0,
          creditsRemaining: Number(r.credits_remaining) || 0,
          cashCollected: Number(r.cash_collected) || 0,
          earnedRevenue: Number(r.earned_revenue) || 0,
          deferredRevenue: Number(r.deferred_revenue) || 0,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        creditLedger: ledgerRows.map((r) => ({
          id: r.id,
          eventType: r.event_type as CreditLedgerEvent["eventType"],
          productId: r.product_id,
          productVersionId: r.product_version_id,
          cohortId: r.cohort_id,
          customerRef: r.customer_ref,
          creditsDelta: Number(r.credits_delta) || 0,
          amountInr: Number(r.amount_inr) || 0,
          eventAt: r.event_at,
          notes: r.notes,
          createdAt: r.created_at || now,
        })),
        actuals: actualRows.map((r) => ({
          id: r.id,
          metricKey: r.metric_key,
          productId: r.product_id || undefined,
          productVersionId: r.product_version_id || undefined,
          periodStart: r.period_start,
          periodEnd: r.period_end,
          assumedValue: Number(r.assumed_value) || 0,
          actualValue: r.actual_value ? Number(r.actual_value) : undefined,
          forecastBasis: (r.forecast_basis as ActualRecord["forecastBasis"]) || "assumed",
          unit: r.unit,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        studios: studioRows.map((r) => parseJson<Studio>(r.data_json, {} as Studio)),
        openQuestions: openQuestionRows.map((r) => ({
          id: r.id,
          question: r.question,
          category: r.category,
          context: r.context,
          status: (r.status as OpenQuestionRecord["status"]) || "open",
          relatedEntityType: r.related_entity_type,
          relatedEntityId: r.related_entity_id,
          resolvedAt: r.resolved_at,
          resolution: r.resolution,
          convertedToDecisionId: r.converted_to_decision_id,
          convertedToRoadmapId: r.converted_to_roadmap_id,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        decisions: decisionRows.map((r) => parseJson<Decision>(r.data_json, {} as Decision)),
        roadmap: roadmapRows.map((r) => ({
          id: r.id,
          title: r.title,
          phase: r.phase,
          status: r.status,
          priority: r.priority,
          owner: r.owner,
          deadline: r.deadline,
          cost: r.cost ? Number(r.cost) : undefined,
          dependency: r.dependency,
          notes: r.notes,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        programming: programmingRows.map((r) => ({
          id: r.id,
          name: r.name,
          classType: r.class_type,
          durationMinutes: r.duration_minutes ? Number(r.duration_minutes) : undefined,
          linkedProductId: r.linked_product_id,
          notes: r.notes,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        brand: brandRows.map((r) => ({
          id: r.id,
          category: r.category,
          title: r.title,
          content: r.content,
          assetId: r.asset_id,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        vendors: vendorRows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          contact: r.contact,
          notes: r.notes,
          assetId: r.asset_id,
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
        library: libraryRows.map((r) => parseJson<LibraryItem>(r.data_json, {} as LibraryItem)),
        assets: assetRows.map((r) => ({
          assetId: r.asset_id,
          driveFileId: r.drive_file_id,
          driveFolderId: r.drive_folder_id,
          filename: r.filename,
          mimeType: r.mime_type,
          category: r.category,
          linkedEntityType: r.linked_entity_type,
          linkedEntityId: r.linked_entity_id,
          sourceUrl: r.source_url,
          notes: r.notes,
          tags: parseJson(r.tags_json, []),
          createdAt: r.created_at || now,
          updatedAt: r.updated_at || now,
        })),
      },
      flags: [],
    };
  }

  async saveAll(data: NormalizedAppData): Promise<SyncResult> {
    const session = await this.getSession();
    let sheetId = session.sheetId;
    if (!sheetId) {
      sheetId = await findOrCreateSpreadsheet(session);
      const driveFolderId = await findOrCreateDriveFolder(session);
      session.sheetId = sheetId;
      session.driveFolderId = driveFolderId;
      await this.saveSession(session);
    }

    await bootstrapSpreadsheetTabs(session, sheetId);
    const now = new Date().toISOString();

    data.settings.lastSyncAt = now;
    data.settings.updatedAt = now;
    data.settings.connectedSheetId = sheetId;
    data.settings.engineVersion = ENGINE_VERSION;
    data.settings.formulaVersion = FORMULA_VERSION;

    await replaceSheetTabData(session, sheetId, "Settings", [
      rowFromRecord("Settings", {
        id: data.settings.id,
        connected_sheet_id: data.settings.connectedSheetId ?? sheetId,
        connected_drive_folder_id: data.settings.connectedDriveFolderId ?? session.driveFolderId,
        google_account_email: data.settings.googleAccountEmail ?? session.email,
        schema_version: data.settings.schemaVersion,
        last_sync_at: data.settings.lastSyncAt,
        sync_status: "saved",
        engine_version: data.settings.engineVersion,
        formula_version: data.settings.formulaVersion,
        created_at: data.settings.createdAt,
        updated_at: data.settings.updatedAt,
      }),
    ]);

    await replaceSheetTabData(session, sheetId, "Assumptions", [
      rowFromRecord("Assumptions", {
        id: data.assumptions.id,
        name: data.assumptions.name,
        is_live: data.assumptions.isLive,
        is_sample: data.assumptions.isSample,
        data_json: JSON.stringify(data.assumptions.data),
        created_at: data.assumptions.createdAt,
        updated_at: data.assumptions.updatedAt,
      }),
    ]);

    await replaceSheetTabData(
      session,
      sheetId,
      "Products",
      data.products.map((p) =>
        rowFromRecord("Products", {
          id: p.id,
          name: p.name,
          type: p.type,
          lifecycle: p.lifecycle,
          version_id: p.versionId,
          version_number: p.versionNumber,
          price: p.price,
          credits_included: p.creditsIncluded,
          gst_follows_global: p.gstFollowsGlobal,
          gst_treatment: p.gstTreatment,
          package_mix_pct: p.packageMixPct,
          peak_eligible: p.peakEligible,
          recurring: p.recurring,
          discount_pct: p.discountPct,
          class_eligibility_json: JSON.stringify(p.classEligibility),
          standing_spot_max_seats_per_class: p.standingSpotMaxSeatsPerClass,
          product_created_at: p.productCreatedAt,
          product_updated_at: p.productUpdatedAt,
          created_at: p.productCreatedAt ?? now,
          updated_at: p.productUpdatedAt ?? now,
        })
      )
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "PackRules",
      data.packRules.map((r) =>
        rowFromRecord("PackRules", {
          id: r.id,
          product_id: r.productId,
          product_version_id: r.productVersionId,
          rules_json: JSON.stringify(r.rules),
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })
      )
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "Scenarios",
      data.scenarios.map((s) =>
        rowFromRecord("Scenarios", {
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          parent_scenario_id: s.parentScenarioId ?? "",
          is_base_case: s.isBaseCase,
          assumptions_json: JSON.stringify(s.assumptions),
          timeline_json: JSON.stringify(s.timeline),
          locked: s.locked,
          archived: s.archived,
          engine_version: s.engineVersion ?? "",
          formula_version: s.formulaVersion ?? "",
          stored_outputs_json: JSON.stringify(s.storedOutputs ?? {}),
          created_at: s.createdAt,
          updated_at: s.updatedAt,
        })
      )
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "OpenQuestions",
      data.openQuestions.map((q) => rowFromRecord("OpenQuestions", {
        id: q.id,
        question: q.question,
        category: q.category ?? "",
        context: q.context ?? "",
        status: q.status,
        related_entity_type: q.relatedEntityType ?? "",
        related_entity_id: q.relatedEntityId ?? "",
        resolved_at: q.resolvedAt ?? "",
        resolution: q.resolution ?? "",
        converted_to_decision_id: q.convertedToDecisionId ?? "",
        converted_to_roadmap_id: q.convertedToRoadmapId ?? "",
        created_at: q.createdAt,
        updated_at: q.updatedAt,
      }))
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "Roadmap",
      data.roadmap.map((r) => rowFromRecord("Roadmap", {
        id: r.id,
        title: r.title,
        phase: r.phase,
        status: r.status,
        priority: r.priority,
        owner: r.owner ?? "",
        deadline: r.deadline ?? "",
        cost: r.cost ?? "",
        dependency: r.dependency ?? "",
        notes: r.notes ?? "",
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }))
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "CreditLedger",
      data.creditLedger.map((e) => rowFromRecord("CreditLedger", {
        id: e.id,
        event_type: e.eventType,
        product_id: e.productId,
        product_version_id: e.productVersionId,
        cohort_id: e.cohortId ?? "",
        customer_ref: e.customerRef ?? "",
        credits_delta: e.creditsDelta,
        amount_inr: e.amountInr,
        event_at: e.eventAt,
        notes: e.notes ?? "",
        created_at: e.createdAt,
      }))
    );

    await replaceSheetTabData(
      session,
      sheetId,
      "PackCohorts",
      data.packCohorts.map((c) => rowFromRecord("PackCohorts", {
        id: c.id,
        product_id: c.productId,
        product_version_id: c.productVersionId,
        purchase_period: c.purchasePeriod,
        activation_period: c.activationPeriod ?? "",
        expiry_period: c.expiryPeriod ?? "",
        credits_sold: c.creditsSold,
        credits_redeemed: c.creditsRedeemed,
        credits_expired: c.creditsExpired,
        credits_remaining: c.creditsRemaining,
        cash_collected: c.cashCollected,
        earned_revenue: c.earnedRevenue,
        deferred_revenue: c.deferredRevenue,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }))
    );

    return {
      success: true,
      syncedAt: now,
      entitiesWritten: data.products.length + data.scenarios.length,
      errors: [],
    };
  }

  async getLiveAssumptions(): Promise<FinanceAssumptions> {
    const data = await this.loadAll();
    return assembleFinanceAssumptions(data.assumptions, data.products);
  }

  async saveAssumptions(assumptions: FinanceAssumptions): Promise<void> {
    const data = await this.loadAll();
    const { products, ...scalars } = assumptions;
    data.products = products;
    data.assumptions = {
      ...data.assumptions,
      data: scalars as Omit<FinanceAssumptions, "products">,
      updatedAt: new Date().toISOString(),
    };
    await this.saveAll(data);
  }

  async listProducts(): Promise<Product[]> {
    return (await this.loadAll()).products;
  }

  async saveProduct(product: Product): Promise<void> {
    const data = await this.loadAll();
    const idx = data.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) data.products[idx] = product;
    else data.products.push(product);
    await this.saveAll(data);
  }

  async getProductVersionHistory(productId: string): Promise<ProductVersionSnapshot[]> {
    const data = await this.loadAll();
    return data.productVersions.filter((v) => v.product.id === productId);
  }

  async listScenarios(): Promise<Scenario[]> {
    return (await this.loadAll()).scenarios;
  }

  async saveScenario(scenario: Scenario): Promise<void> {
    const data = await this.loadAll();
    const idx = data.scenarios.findIndex((s) => s.id === scenario.id);
    if (idx >= 0) data.scenarios[idx] = scenario;
    else data.scenarios.push(scenario);
    await this.saveAll(data);
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return (await this.loadAll()).scenarioSnapshots;
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    const data = await this.loadAll();
    data.scenarioSnapshots.unshift(snapshot);
    await this.saveAll(data);
  }

  async appendLedgerEvents(events: CreditLedgerEvent[]): Promise<void> {
    const data = await this.loadAll();
    data.creditLedger.push(...events);
    await this.saveAll(data);
  }

  async listLedgerEvents(filter?: { productId?: string }): Promise<CreditLedgerEvent[]> {
    const data = await this.loadAll();
    return filter?.productId
      ? data.creditLedger.filter((e) => e.productId === filter.productId)
      : data.creditLedger;
  }

  async listPackCohorts(): Promise<PackCohortRecord[]> {
    return (await this.loadAll()).packCohorts;
  }

  async upsertPackCohorts(cohorts: PackCohortRecord[]): Promise<void> {
    const data = await this.loadAll();
    for (const c of cohorts) {
      const idx = data.packCohorts.findIndex((x) => x.id === c.id);
      if (idx >= 0) data.packCohorts[idx] = c;
      else data.packCohorts.push(c);
    }
    await this.saveAll(data);
  }

  async listActuals(): Promise<ActualRecord[]> {
    return (await this.loadAll()).actuals;
  }

  async upsertActuals(records: ActualRecord[]): Promise<void> {
    const data = await this.loadAll();
    for (const r of records) {
      const idx = data.actuals.findIndex((x) => x.id === r.id);
      if (idx >= 0) data.actuals[idx] = r;
      else data.actuals.push(r);
    }
    await this.saveAll(data);
  }

  async listStudios(): Promise<Studio[]> {
    return (await this.loadAll()).studios;
  }

  async saveStudio(studio: Studio): Promise<void> {
    const data = await this.loadAll();
    const idx = data.studios.findIndex((s) => s.id === studio.id);
    if (idx >= 0) data.studios[idx] = studio;
    else data.studios.push(studio);
    await this.saveAll(data);
  }

  async listDecisions(): Promise<Decision[]> {
    return (await this.loadAll()).decisions;
  }

  async saveDecision(decision: Decision): Promise<void> {
    const data = await this.loadAll();
    const idx = data.decisions.findIndex((d) => d.id === decision.id);
    if (idx >= 0) data.decisions[idx] = decision;
    else data.decisions.push(decision);
    await this.saveAll(data);
  }

  async listLibraryItems(): Promise<LibraryItem[]> {
    return (await this.loadAll()).library;
  }

  async saveLibraryItem(item: LibraryItem): Promise<void> {
    const data = await this.loadAll();
    const idx = data.library.findIndex((l) => l.id === item.id);
    if (idx >= 0) data.library[idx] = item;
    else data.library.push(item);
    await this.saveAll(data);
  }

  async listOpenQuestions(): Promise<OpenQuestionRecord[]> {
    return (await this.loadAll()).openQuestions;
  }

  async saveOpenQuestion(question: OpenQuestionRecord): Promise<void> {
    const data = await this.loadAll();
    const idx = data.openQuestions.findIndex((q) => q.id === question.id);
    if (idx >= 0) data.openQuestions[idx] = question;
    else data.openQuestions.push(question);
    await this.saveAll(data);
  }

  async listRoadmap(): Promise<RoadmapRecord[]> {
    return (await this.loadAll()).roadmap;
  }

  async saveRoadmapItem(item: RoadmapRecord): Promise<void> {
    const data = await this.loadAll();
    const idx = data.roadmap.findIndex((r) => r.id === item.id);
    if (idx >= 0) data.roadmap[idx] = item;
    else data.roadmap.push(item);
    await this.saveAll(data);
  }

  async listProgramming(): Promise<ProgrammingRecord[]> {
    return (await this.loadAll()).programming;
  }

  async saveProgrammingItem(item: ProgrammingRecord): Promise<void> {
    const data = await this.loadAll();
    const idx = data.programming.findIndex((p) => p.id === item.id);
    if (idx >= 0) data.programming[idx] = item;
    else data.programming.push(item);
    await this.saveAll(data);
  }

  async listBrand(): Promise<BrandRecord[]> {
    return (await this.loadAll()).brand;
  }

  async saveBrandItem(item: BrandRecord): Promise<void> {
    const data = await this.loadAll();
    const idx = data.brand.findIndex((b) => b.id === item.id);
    if (idx >= 0) data.brand[idx] = item;
    else data.brand.push(item);
    await this.saveAll(data);
  }

  async listVendors(): Promise<VendorRecord[]> {
    return (await this.loadAll()).vendors;
  }

  async saveVendor(vendor: VendorRecord): Promise<void> {
    const data = await this.loadAll();
    const idx = data.vendors.findIndex((v) => v.id === vendor.id);
    if (idx >= 0) data.vendors[idx] = vendor;
    else data.vendors.push(vendor);
    await this.saveAll(data);
  }

  async syncNow(): Promise<SyncResult> {
    const data = await this.loadAll();
    return this.saveAll(data);
  }

  async exportStructuredBackup(): Promise<OwnedBackupV1> {
    const data = await this.loadAll();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: process.env.npm_package_version ?? "0.1.0",
      data,
      assetMetadata: data.assets,
    };
  }

  async importStructuredBackup(backup: OwnedBackupV1): Promise<void> {
    await this.saveAll(backup.data);
  }

  async resolveConflict<T>(_conflict: Conflict<T>, _resolution: "local" | "remote"): Promise<void> {
    // Single-user MVP — explicit resolution in sync service
  }

  async migrateFromLegacy(legacy: LegacyAppState) {
    return migrateLegacyAppState(legacy);
  }
}

export { denormalizeToLegacyShape, migrateLegacyAppState };
