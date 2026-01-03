import type { Action, PortfolioSnapshot, RunResult } from "@bot/core";
import type { Strategy } from "@bot/strategy";

/**
 * ---- Storage Adapter Interface ----
 * Abstraction layer for persistence operations.
 * Used for logging, history, and Phase 2 strategy storage.
 */
export interface StorageAdapter {
  // ---- Snapshots ----

  /**
   * Save a portfolio snapshot.
   */
  saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>;

  /**
   * Get the most recent snapshot.
   */
  getLatestSnapshot(): Promise<PortfolioSnapshot | null>;

  /**
   * Get snapshots within a date range.
   */
  getSnapshots(startDate: Date, endDate: Date): Promise<PortfolioSnapshot[]>;

  // ---- Runs ----

  /**
   * Save a run result.
   */
  saveRun(run: RunResult): Promise<void>;

  /**
   * Get a run by ID.
   */
  getRun(id: string): Promise<RunResult | null>;

  /**
   * Get recent runs.
   */
  getRecentRuns(limit: number): Promise<RunResult[]>;

  /**
   * Get runs by type.
   */
  getRunsByType(
    type: "monthly_investment" | "yearly_rebalance",
    limit: number
  ): Promise<RunResult[]>;

  // ---- Actions ----

  /**
   * Save an action.
   */
  saveAction(action: Action): Promise<void>;

  /**
   * Get actions for a specific run.
   */
  getActionsForRun(runId: string): Promise<Action[]>;

  /**
   * Get recent actions.
   */
  getRecentActions(limit: number): Promise<Action[]>;

  // ---- Strategy (Phase 2) ----

  /**
   * Get the current strategy from database.
   * Returns null if no strategy is stored (use config file instead).
   */
  getStrategy(): Promise<Strategy | null>;

  /**
   * Save/update the strategy in database.
   * Used when UI editing is enabled.
   */
  saveStrategy(strategy: Strategy): Promise<void>;

  // ---- Health ----

  /**
   * Check if storage connection is healthy.
   */
  isHealthy(): Promise<boolean>;
}

/**
 * ---- Storage Adapter Options ----
 */
export interface StorageAdapterOptions {
  /** Supabase URL */
  url: string;
  /** Supabase anon key */
  anonKey: string;
}
