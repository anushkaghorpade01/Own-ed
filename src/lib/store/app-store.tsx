"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import type { AppState } from "./app-state";
import {
  ENGINE_VERSION,
  FORMULA_VERSION,
  analyzeScenario,
  serializeScenarioOutputs,
} from "@/lib/finance/engine/scenarios";
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
  MathReviewItem,
  Scenario,
  Snapshot,
  Product,
  ProductVersionSnapshot,
} from "@/lib/finance/schemas";
import { defaultAppState } from "./default-state";
import { persistenceService } from "@/lib/data/local/persistence-service";
import type { LocalSaveStatus, LocalPersistenceStats } from "@/lib/data/types";
import { normalizeAssumptions } from "@/lib/finance/validation";
import {
  ensureProductVersionFields,
  snapshotProduct,
  newVersionId,
  newProductId,
  createBlankFlexibleProduct,
  productHasHistoricalUsage,
  getProductById,
} from "@/lib/finance/engine/product-catalog";

const LEGACY_SAMPLE_IDS = new Set([
  "dec-1",
  "dec-2",
  "dec-3",
  "a-1",
  "a-2",
  "a-3",
  "lib-1",
  "lib-2",
  "studio-1",
]);

function stripLegacySampleContent<T extends { id: string }>(items: T[] | undefined): T[] {
  return (items ?? []).filter((item) => !LEGACY_SAMPLE_IDS.has(item.id));
}

export type { AppState } from "./app-state";

const defaultState = defaultAppState;

interface AppContextValue {
  state: AppState;
  updateAssumptions: (updates: Partial<FinanceAssumptions>, options?: { trackUndo?: boolean }) => void;
  setAssumptions: (assumptions: FinanceAssumptions) => void;
  addDecision: (decision: Decision) => void;
  updateDecision: (id: string, updates: Partial<Decision>) => void;
  addQuestion: (question: OpenQuestion) => void;
  addAction: (action: NextAction) => void;
  toggleAction: (id: string) => void;
  addMathReviewItem: (item: MathReviewItem) => void;
  updateMathReviewItem: (id: string, updates: Partial<MathReviewItem>) => void;
  deleteMathReviewItem: (id: string) => void;
  addRoadmapItem: (item: RoadmapItem) => void;
  updateRoadmapItem: (id: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (id: string) => void;
  addProductConcept: (item: ProductConcept) => void;
  updateProductConcept: (id: string, updates: Partial<ProductConcept>) => void;
  deleteProductConcept: (id: string) => void;
  addProgrammingItem: (item: ProgrammingItem) => void;
  updateProgrammingItem: (id: string, updates: Partial<ProgrammingItem>) => void;
  deleteProgrammingItem: (id: string) => void;
  addStudio: (studio: Studio) => void;
  updateStudio: (id: string, updates: Partial<Studio>) => void;
  deleteStudio: (id: string) => void;
  addSpaceImage: (image: SpaceImage) => void;
  updateSpaceImage: (id: string, updates: Partial<SpaceImage>) => void;
  deleteSpaceImage: (id: string) => void;
  addBrandItem: (item: BrandItem) => void;
  updateBrandItem: (id: string, updates: Partial<BrandItem>) => void;
  deleteBrandItem: (id: string) => void;
  archiveBrandItem: (id: string, archived: boolean) => void;
  addLibraryItem: (item: LibraryItem) => void;
  addScenario: (scenario: Scenario) => void;
  duplicateScenario: (id: string) => void;
  updateScenario: (id: string, updates: Partial<Scenario>) => void;
  updateScenarioAssumptions: (id: string, updates: Partial<FinanceAssumptions>) => void;
  renameScenario: (id: string, name: string) => void;
  archiveScenario: (id: string, archived: boolean) => void;
  setAsBaseCase: (id: string) => void;
  createScenarioFromBase: (name: string, parentId?: string) => void;
  createOptimisationScenario: (
    name: string,
    assumptions: FinanceAssumptions,
    description?: string
  ) => string;
  saveScenarioOutputs: (id: string) => void;
  saveSnapshot: (name: string, notes?: string, outputs?: Record<string, unknown>) => void;
  /** Product catalog — canonical configuration */
  saveProduct: (product: Product, options?: { asDraft?: boolean; bumpVersion?: boolean }) => void;
  createProduct: (product?: Product) => string;
  duplicateProduct: (productId: string) => string;
  archiveProduct: (productId: string) => void;
  deleteProduct: (productId: string) => boolean;
  activateProduct: (productId: string) => void;
  createScenarioTestingProduct: (productId: string, draftProduct: Product, scenarioName?: string) => string;
  getProductVersionHistory: (productId: string) => ProductVersionSnapshot[];
  undo: () => void;
  lastSaved: string | null;
  saveStatus: LocalSaveStatus;
  persistenceStats: LocalPersistenceStats | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<LocalSaveStatus>("idle");
  const [persistenceStats, setPersistenceStats] = useState<LocalPersistenceStats | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    persistenceService
      .loadAppState()
      .then((loaded) => {
        const defaults = defaultState();
        const assumptions = normalizeAssumptions(loaded.assumptions, defaults.assumptions);
        const scenarios = loaded.scenarios.map((s: Scenario) => ({
          ...s,
          assumptions: normalizeAssumptions(s.assumptions, assumptions),
          timeline: s.timeline ?? [],
          isBaseCase: s.isBaseCase ?? false,
          archived: s.archived ?? false,
        }));
        setState({
          ...loaded,
          assumptions,
          scenarios,
          decisions: stripLegacySampleContent(loaded.decisions),
          actions: stripLegacySampleContent(loaded.actions),
          libraryItems: stripLegacySampleContent(loaded.libraryItems),
          studios: stripLegacySampleContent(loaded.studios),
          undoStack: [],
        });
      })
      .catch((error) => {
        console.error("Failed to load saved app state, using defaults:", error);
        setState(defaultState());
      })
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    const unsubStatus = persistenceService.subscribeSaveStatus((status, at) => {
      setSaveStatus(status);
      if (at) setLastSaved(at);
    });
    const unsubStats = persistenceService.subscribeStats(setPersistenceStats);
    return () => {
      unsubStatus();
      unsubStats();
    };
  }, []);

  const persist = useCallback((newState: AppState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistenceService.saveAppState(newState).catch((error) => {
        console.error("Local save failed:", error);
      });
    }, 500);
  }, []);

  const pushUndo = useCallback((prev: AppState): AppState => {
    const snapshot = { assumptions: prev.assumptions };
    const undoStack = [snapshot, ...prev.undoStack].slice(0, 20);
    return { ...prev, undoStack };
  }, []);

  const updateState = useCallback(
    (updater: (prev: AppState) => AppState, trackUndo = false) => {
      setState((prev) => {
        const next = updater(trackUndo ? pushUndo(prev) : prev);
        persist(next);
        return next;
      });
    },
    [persist, pushUndo]
  );

  const updateAssumptions = useCallback(
    (updates: Partial<FinanceAssumptions>, options?: { trackUndo?: boolean }) => {
      updateState(
        (prev) => ({
          ...prev,
          assumptions: {
            ...prev.assumptions,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        }),
        options?.trackUndo !== false
      );
    },
    [updateState]
  );

  const setAssumptions = useCallback(
    (assumptions: FinanceAssumptions) => {
      updateState((prev) => ({ ...prev, assumptions }), true);
    },
    [updateState]
  );

  const addDecision = useCallback(
    (decision: Decision) => {
      updateState((prev) => ({ ...prev, decisions: [decision, ...prev.decisions] }));
    },
    [updateState]
  );

  const updateDecision = useCallback(
    (id: string, updates: Partial<Decision>) => {
      updateState((prev) => ({
        ...prev,
        decisions: prev.decisions.map((d) =>
          d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d
        ),
      }));
    },
    [updateState]
  );

  const addQuestion = useCallback(
    (question: OpenQuestion) => {
      updateState((prev) => ({ ...prev, questions: [question, ...prev.questions] }));
    },
    [updateState]
  );

  const addAction = useCallback(
    (action: NextAction) => {
      updateState((prev) => ({ ...prev, actions: [action, ...prev.actions] }));
    },
    [updateState]
  );

  const toggleAction = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        actions: prev.actions.map((a) =>
          a.id === id ? { ...a, completed: !a.completed } : a
        ),
      }));
    },
    [updateState]
  );

  const addMathReviewItem = useCallback(
    (item: MathReviewItem) => {
      updateState((prev) => ({
        ...prev,
        mathReviewItems: [item, ...prev.mathReviewItems],
      }));
    },
    [updateState]
  );

  const updateMathReviewItem = useCallback(
    (id: string, updates: Partial<MathReviewItem>) => {
      updateState((prev) => ({
        ...prev,
        mathReviewItems: prev.mathReviewItems.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date().toISOString() }
            : item
        ),
      }));
    },
    [updateState]
  );

  const deleteMathReviewItem = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        mathReviewItems: prev.mathReviewItems.filter((item) => item.id !== id),
      }));
    },
    [updateState]
  );

  const addRoadmapItem = useCallback(
    (item: RoadmapItem) => {
      updateState((prev) => ({ ...prev, roadmapItems: [item, ...prev.roadmapItems] }));
    },
    [updateState]
  );

  const updateRoadmapItem = useCallback(
    (id: string, updates: Partial<RoadmapItem>) => {
      updateState((prev) => ({
        ...prev,
        roadmapItems: prev.roadmapItems.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      }));
    },
    [updateState]
  );

  const deleteRoadmapItem = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        roadmapItems: prev.roadmapItems.filter((item) => item.id !== id),
      }));
    },
    [updateState]
  );

  const addProductConcept = useCallback(
    (item: ProductConcept) => {
      updateState((prev) => ({ ...prev, productConcepts: [item, ...prev.productConcepts] }));
    },
    [updateState]
  );

  const updateProductConcept = useCallback(
    (id: string, updates: Partial<ProductConcept>) => {
      updateState((prev) => ({
        ...prev,
        productConcepts: prev.productConcepts.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      }));
    },
    [updateState]
  );

  const deleteProductConcept = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        productConcepts: prev.productConcepts.filter((item) => item.id !== id),
      }));
    },
    [updateState]
  );

  const addProgrammingItem = useCallback(
    (item: ProgrammingItem) => {
      updateState((prev) => ({ ...prev, programmingItems: [item, ...prev.programmingItems] }));
    },
    [updateState]
  );

  const updateProgrammingItem = useCallback(
    (id: string, updates: Partial<ProgrammingItem>) => {
      updateState((prev) => ({
        ...prev,
        programmingItems: prev.programmingItems.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      }));
    },
    [updateState]
  );

  const deleteProgrammingItem = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        programmingItems: prev.programmingItems.filter((item) => item.id !== id),
      }));
    },
    [updateState]
  );

  const addStudio = useCallback(
    (studio: Studio) => {
      updateState((prev) => ({ ...prev, studios: [studio, ...prev.studios] }));
    },
    [updateState]
  );

  const updateStudio = useCallback(
    (id: string, updates: Partial<Studio>) => {
      updateState((prev) => ({
        ...prev,
        studios: prev.studios.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [updateState]
  );

  const deleteStudio = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        studios: prev.studios.filter((s) => s.id !== id),
      }));
    },
    [updateState]
  );

  const addSpaceImage = useCallback(
    (image: SpaceImage) => {
      updateState((prev) => ({ ...prev, spaceImages: [image, ...prev.spaceImages] }));
    },
    [updateState]
  );

  const updateSpaceImage = useCallback(
    (id: string, updates: Partial<SpaceImage>) => {
      updateState((prev) => ({
        ...prev,
        spaceImages: prev.spaceImages.map((img) =>
          img.id === id ? { ...img, ...updates, updatedAt: new Date().toISOString() } : img
        ),
      }));
    },
    [updateState]
  );

  const deleteSpaceImage = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        spaceImages: prev.spaceImages.filter((img) => img.id !== id),
      }));
    },
    [updateState]
  );

  const addBrandItem = useCallback(
    (item: BrandItem) => {
      updateState((prev) => ({ ...prev, brandItems: [item, ...prev.brandItems] }));
    },
    [updateState]
  );

  const updateBrandItem = useCallback(
    (id: string, updates: Partial<BrandItem>) => {
      updateState((prev) => ({
        ...prev,
        brandItems: prev.brandItems.map((item) =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      }));
    },
    [updateState]
  );

  const deleteBrandItem = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        brandItems: prev.brandItems.filter((item) => item.id !== id),
      }));
    },
    [updateState]
  );

  const archiveBrandItem = useCallback(
    (id: string, archived: boolean) => {
      updateBrandItem(id, { status: archived ? "archived" : "active" });
    },
    [updateBrandItem]
  );

  const addLibraryItem = useCallback(
    (item: LibraryItem) => {
      updateState((prev) => ({ ...prev, libraryItems: [item, ...prev.libraryItems] }));
    },
    [updateState]
  );

  const addScenario = useCallback(
    (scenario: Scenario) => {
      updateState((prev) => ({ ...prev, scenarios: [...prev.scenarios, scenario] }));
    },
    [updateState]
  );

  const duplicateScenario = useCallback(
    (id: string) => {
      updateState((prev) => {
        const source = prev.scenarios.find((s) => s.id === id);
        if (!source) return prev;
        const now = new Date().toISOString();
        const copy: Scenario = {
          ...source,
          id: `scenario-${Date.now()}`,
          name: `${source.name} (copy)`,
          assumptions: structuredClone(source.assumptions),
          parentScenarioId: source.id,
          isBaseCase: false,
          createdAt: now,
          updatedAt: now,
          locked: false,
        };
        return { ...prev, scenarios: [...prev.scenarios, copy] };
      });
    },
    [updateState]
  );

  const updateScenario = useCallback(
    (id: string, updates: Partial<Scenario>) => {
      updateState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((s) =>
          s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        ),
      }));
    },
    [updateState]
  );

  const updateScenarioAssumptions = useCallback(
    (id: string, updates: Partial<FinanceAssumptions>) => {
      const synced =
        updates.projectedBookedOccupancyPct !== undefined
          ? {
              ...updates,
              rampUpTargetOccupancyPct: updates.projectedBookedOccupancyPct,
            }
          : updates;
      updateState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((s) =>
          s.id === id
            ? {
                ...s,
                assumptions: {
                  ...s.assumptions,
                  ...synced,
                  updatedAt: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              }
            : s
        ),
      }));
    },
    [updateState]
  );

  const renameScenario = useCallback(
    (id: string, name: string) => {
      updateScenario(id, { name });
      updateScenarioAssumptions(id, { name });
    },
    [updateScenario, updateScenarioAssumptions]
  );

  const archiveScenario = useCallback(
    (id: string, archived: boolean) => {
      updateScenario(id, { archived });
    },
    [updateScenario]
  );

  const setAsBaseCase = useCallback(
    (id: string) => {
      updateState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((s) => ({
          ...s,
          isBaseCase: s.id === id,
          updatedAt: new Date().toISOString(),
        })),
      }));
    },
    [updateState]
  );

  const createScenarioFromBase = useCallback(
    (name: string, parentId?: string) => {
      updateState((prev) => {
        const parent =
          prev.scenarios.find((s) => s.id === parentId) ??
          prev.scenarios.find((s) => s.isBaseCase) ??
          prev.scenarios[0];
        if (!parent) return prev;
        const now = new Date().toISOString();
        const scenario: Scenario = {
          id: `scenario-${Date.now()}`,
          name,
          assumptions: structuredClone(parent.assumptions),
          parentScenarioId: parent.id,
          isBaseCase: false,
          timeline: [],
          locked: false,
          archived: false,
          engineVersion: ENGINE_VERSION,
          formulaVersion: FORMULA_VERSION,
          createdAt: now,
          updatedAt: now,
        };
        scenario.assumptions.name = name;
        return { ...prev, scenarios: [...prev.scenarios, scenario] };
      });
    },
    [updateState]
  );

  const createOptimisationScenario = useCallback(
    (name: string, assumptions: FinanceAssumptions, description?: string) => {
      const id = `scenario-opt-${Date.now()}`;
      updateState((prev) => {
        const parent =
          prev.scenarios.find((s) => s.isBaseCase) ?? prev.scenarios[0];
        const now = new Date().toISOString();
        const scenario: Scenario = {
          id,
          name,
          description:
            description ??
            "Draft optimisation scenario — created from Optimise page. Does not change Base Case until you set as base.",
          assumptions: structuredClone(assumptions),
          parentScenarioId: parent?.id,
          isBaseCase: false,
          timeline: [],
          locked: false,
          archived: false,
          engineVersion: ENGINE_VERSION,
          formulaVersion: FORMULA_VERSION,
          createdAt: now,
          updatedAt: now,
        };
        scenario.assumptions.name = name;
        return { ...prev, scenarios: [...prev.scenarios, scenario] };
      });
      return id;
    },
    [updateState]
  );

  const saveScenarioOutputs = useCallback(
    (id: string) => {
      updateState((prev) => {
        const scenario = prev.scenarios.find((s) => s.id === id);
        if (!scenario) return prev;
        const analysis = analyzeScenario(scenario.assumptions);
        const storedOutputs = serializeScenarioOutputs(analysis);
        return {
          ...prev,
          scenarios: prev.scenarios.map((s) =>
            s.id === id
              ? {
                  ...s,
                  storedOutputs,
                  engineVersion: ENGINE_VERSION,
                  formulaVersion: FORMULA_VERSION,
                  updatedAt: new Date().toISOString(),
                }
              : s
          ),
        };
      });
    },
    [updateState]
  );

  const saveSnapshot = useCallback(
    (name: string, notes?: string, outputs?: Record<string, unknown>) => {
      updateState((prev) => ({
        ...prev,
        snapshots: [
          {
            id: `snapshot-${Date.now()}`,
            name,
            notes,
            assumptions: structuredClone(prev.assumptions),
            outputs: outputs ?? {},
            createdAt: new Date().toISOString(),
            immutable: true,
          },
          ...prev.snapshots,
        ],
      }));
    },
    [updateState]
  );

  const saveProduct = useCallback(
    (
      product: Product,
      options?: { asDraft?: boolean; bumpVersion?: boolean }
    ) => {
      updateState((prev) => {
        const existing = getProductById(prev.assumptions, product.id);
        const bump = options?.bumpVersion ?? !!existing;
        const history = { ...prev.productVersionHistory };

        if (existing && bump) {
          const snap = snapshotProduct(existing, "Prior version before edit");
          history[product.id] = [...(history[product.id] ?? []), snap];
        }

        const now = new Date().toISOString();
        const saved = ensureProductVersionFields({
          ...product,
          lifecycle: options?.asDraft ? "draft" : product.lifecycle === "draft" ? "draft" : "active",
          versionNumber: bump
            ? (existing?.versionNumber ?? 0) + 1
            : product.versionNumber ?? 1,
          versionId: bump ? newVersionId() : product.versionId ?? newVersionId(),
          productUpdatedAt: now,
          productCreatedAt: product.productCreatedAt ?? existing?.productCreatedAt ?? now,
        });

        const products = existing
          ? prev.assumptions.products.map((p) => (p.id === product.id ? saved : p))
          : [...prev.assumptions.products, saved];

        return {
          ...prev,
          productVersionHistory: history,
          assumptions: {
            ...prev.assumptions,
            products,
            updatedAt: now,
          },
        };
      }, true);
    },
    [updateState]
  );

  const createProduct = useCallback(
    (product?: Product) => {
      const p = ensureProductVersionFields(product ?? createBlankFlexibleProduct());
      saveProduct(p, { asDraft: true, bumpVersion: false });
      return p.id;
    },
    [saveProduct]
  );

  const duplicateProduct = useCallback(
    (productId: string) => {
      const source = getProductById(state.assumptions, productId);
      if (!source) return productId;
      const copy = ensureProductVersionFields({
        ...structuredClone(source),
        id: newProductId("flex"),
        name: `${source.name} (copy)`,
        lifecycle: "draft",
        versionNumber: 1,
        versionId: newVersionId(),
        productCreatedAt: new Date().toISOString(),
        productUpdatedAt: new Date().toISOString(),
      });
      saveProduct(copy, { asDraft: true, bumpVersion: false });
      return copy.id;
    },
    [state.assumptions, saveProduct]
  );

  const archiveProduct = useCallback(
    (productId: string) => {
      const p = getProductById(state.assumptions, productId);
      if (!p) return;
      saveProduct({ ...p, lifecycle: "archived" }, { bumpVersion: false });
    },
    [state.assumptions, saveProduct]
  );

  const deleteProduct = useCallback(
    (productId: string) => {
      if (productHasHistoricalUsage(productId, state)) return false;
      updateState((prev) => ({
        ...prev,
        assumptions: {
          ...prev.assumptions,
          products: prev.assumptions.products.filter((p) => p.id !== productId),
          updatedAt: new Date().toISOString(),
        },
      }), true);
      return true;
    },
    [state, updateState]
  );

  const activateProduct = useCallback(
    (productId: string) => {
      const p = getProductById(state.assumptions, productId);
      if (!p) return;
      saveProduct({ ...p, lifecycle: "active" }, { bumpVersion: false });
    },
    [state.assumptions, saveProduct]
  );

  const createScenarioTestingProduct = useCallback(
    (productId: string, draftProduct: Product, scenarioName?: string) => {
      const scenarioId = `scenario-${Date.now()}`;
      updateState((prev) => {
        const products = prev.assumptions.products.map((p) =>
          p.id === productId ? ensureProductVersionFields(draftProduct) : p
        );
        const testAssumptions: FinanceAssumptions = {
          ...structuredClone(prev.assumptions),
          products,
          name: scenarioName ?? `Test: ${draftProduct.name}`,
        };
        const now = new Date().toISOString();
        const scenario: Scenario = {
          id: scenarioId,
          name: scenarioName ?? `Test: ${draftProduct.name}`,
          description: `Scenario testing proposed ${draftProduct.name} configuration (product ${productId} v${draftProduct.versionNumber ?? "draft"})`,
          assumptions: testAssumptions,
          parentScenarioId: prev.scenarios.find((s) => s.isBaseCase)?.id,
          isBaseCase: false,
          timeline: [],
          locked: false,
          archived: false,
          engineVersion: ENGINE_VERSION,
          formulaVersion: FORMULA_VERSION,
          createdAt: now,
          updatedAt: now,
        };
        return { ...prev, scenarios: [...prev.scenarios, scenario] };
      });
      return scenarioId;
    },
    [updateState]
  );

  const getProductVersionHistory = useCallback(
    (productId: string) => state.productVersionHistory[productId] ?? [],
    [state.productVersionHistory]
  );

  const undo = useCallback(() => {
    updateState((prev) => {
      if (prev.undoStack.length === 0) return prev;
      const [last, ...rest] = prev.undoStack;
      return {
        ...prev,
        assumptions: last.assumptions ?? prev.assumptions,
        undoStack: rest,
      };
    });
  }, [updateState]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5]">
        <p className="text-sm text-[#6B6560]">Loading Own-ed…</p>
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        state,
        updateAssumptions,
        setAssumptions,
        addDecision,
        updateDecision,
        addQuestion,
        addAction,
        toggleAction,
        addMathReviewItem,
        updateMathReviewItem,
        deleteMathReviewItem,
        addRoadmapItem,
        updateRoadmapItem,
        deleteRoadmapItem,
        addProductConcept,
        updateProductConcept,
        deleteProductConcept,
        addProgrammingItem,
        updateProgrammingItem,
        deleteProgrammingItem,
        addStudio,
        updateStudio,
        deleteStudio,
        addSpaceImage,
        updateSpaceImage,
        deleteSpaceImage,
        addBrandItem,
        updateBrandItem,
        deleteBrandItem,
        archiveBrandItem,
        addLibraryItem,
        addScenario,
        duplicateScenario,
        updateScenario,
        updateScenarioAssumptions,
        renameScenario,
        archiveScenario,
        setAsBaseCase,
        createScenarioFromBase,
        createOptimisationScenario,
        saveScenarioOutputs,
        saveSnapshot,
        saveProduct,
        createProduct,
        duplicateProduct,
        archiveProduct,
        deleteProduct,
        activateProduct,
        createScenarioTestingProduct,
        getProductVersionHistory,
        undo,
        lastSaved,
        saveStatus,
        persistenceStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
