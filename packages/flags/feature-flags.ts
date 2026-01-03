import { z } from "zod";

/**
 * ---- Strategy Source ----
 * Defines where the bot reads its strategy from.
 *
 * - "file": Strategy comes from config/strategy.yaml (default)
 * - "database": Strategy comes from Supabase (only valid when UI editing is enabled)
 *
 * IMPORTANT: The bot never merges config and database strategies.
 * One source. One truth.
 */
export const StrategySourceSchema = z.enum(["file", "database"]).default("file");

export type StrategySource = z.infer<typeof StrategySourceSchema>;

/**
 * ---- Feature Flags Schema ----
 */
export const FeatureFlagsSchema = z.object({
  exchange: z.object({
    binance: z.boolean().default(true),
  }),

  storage: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(["supabase"]).optional(),
  }),

  alerts: z.object({
    enabled: z.boolean().default(false),
    telegram: z.boolean().default(false),
  }),

  ai: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(["adk-ts"]).optional(),
  }),

  ui: z.object({
    enabled: z.boolean().default(false),
    /**
     * Whether the UI can edit the strategy.
     * - false: Read-only UI (Phase 1)
     * - true: Strategy editing enabled (Phase 2)
     *
     * When true, strategy is read from database, not config file.
     */
    strategyEditing: z.boolean().default(false),
  }),

  /**
   * Source of strategy configuration.
   * This is derived from ui.strategyEditing but can be explicitly set.
   *
   * Rules:
   * - Default: "file"
   * - "database" is ONLY valid when:
   *   - ui.enabled = true
   *   - ui.strategyEditing = true
   *   - storage.enabled = true
   */
  strategySource: StrategySourceSchema,
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Validates feature flag combinations.
 * Fails fast on invalid configurations.
 */
export function validateFeatureFlags(flags: FeatureFlags): void {
  // Rule: strategySource = "database" requires UI with editing and storage
  if (flags.strategySource === "database") {
    if (!flags.ui.enabled) {
      throw new Error("Invalid configuration: strategySource='database' requires ui.enabled=true");
    }
    if (!flags.ui.strategyEditing) {
      throw new Error(
        "Invalid configuration: strategySource='database' requires ui.strategyEditing=true"
      );
    }
    if (!flags.storage.enabled) {
      throw new Error(
        "Invalid configuration: strategySource='database' requires storage.enabled=true"
      );
    }
  }

  // Rule: ui.strategyEditing = true requires storage
  if (flags.ui.strategyEditing && !flags.storage.enabled) {
    throw new Error("Invalid configuration: ui.strategyEditing=true requires storage.enabled=true");
  }
}

/**
 * Resolves the effective strategy source based on flags.
 * Use this instead of reading strategySource directly.
 */
export function resolveStrategySource(flags: FeatureFlags): StrategySource {
  // If UI editing is enabled and storage is available, use database
  if (flags.ui.enabled && flags.ui.strategyEditing && flags.storage.enabled) {
    return "database";
  }

  // Otherwise, always use file
  return "file";
}
