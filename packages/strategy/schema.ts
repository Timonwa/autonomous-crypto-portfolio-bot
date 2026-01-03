import { z } from "zod";

/**
 * ---- Core Domain Types ----
 */

export const AssetSymbol = z.enum(["BTC", "ETH", "SOL", "BNB", "USDT"]);

export type AssetSymbol = z.infer<typeof AssetSymbol>;

/**
 * ---- Allocation ----
 * How total capital is split across assets
 */
export const AllocationSchema = z.record(AssetSymbol, z.number().min(0).max(1));

export type Allocation = z.infer<typeof AllocationSchema>;

/**
 * ---- Earn Rules ----
 * How each asset is split across earn products
 */
export const EarnSplitSchema = z
  .object({
    staking: z.number().min(0).max(1).optional(),
    locked: z.number().min(0).max(1).optional(),
    flex: z.number().min(0).max(1).optional(),
  })
  .refine(
    (split) => {
      const total = (split.staking ?? 0) + (split.locked ?? 0) + (split.flex ?? 0);
      return total <= 1.0001; // Allow small floating point error
    },
    { message: "Earn split percentages must not exceed 1.0" }
  );

export type EarnSplit = z.infer<typeof EarnSplitSchema>;

export const EarnRulesSchema = z.record(AssetSymbol, EarnSplitSchema);

export type EarnRules = z.infer<typeof EarnRulesSchema>;

/**
 * ---- Safety Constraints ----
 * Non-negotiable rules that protect the user
 */
export const SafetyRulesSchema = z.object({
  /** Maximum percentage of any asset that can be locked */
  maxLockedPercentage: z.number().min(0).max(1).default(0.8),
  /** Minimum percentage that must remain in flexible/liquid state */
  minFlexPercentage: z.number().min(0).max(1).default(0.2),
  /** Allow selling - only true during rebalancing */
  allowSell: z.boolean().default(false),
  /** Never allow futures trading */
  allowFutures: z.literal(false),
  /** Never allow margin trading */
  allowMargin: z.literal(false),
  /** Never allow structured products */
  allowStructuredProducts: z.literal(false),
});

export type SafetyRules = z.infer<typeof SafetyRulesSchema>;

/**
 * ---- Bot Schedule ----
 */
export const ScheduleSchema = z.object({
  type: z.literal("cron"),
  /** Cron expression, e.g. "0 9 3 * *" for 9 AM on the 3rd of each month */
  expression: z.string().regex(/^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+$/, {
    message: "Invalid cron expression format",
  }),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

/**
 * ---- Yearly Rebalancing ----
 * Runs once per year to realign portfolio with target allocation
 */
export const RebalanceSchema = z.object({
  /** Rebalancing is compulsory - always enabled */
  enabled: z.literal(true),
  /** Month to run rebalancing (1 = January, 12 = December) */
  month: z.number().min(1).max(12).default(1),
  /** Tolerance before rebalancing triggers (+/- percentage points) */
  tolerancePercent: z.number().min(0).max(100).default(5),
  /** Day of month to run rebalancing */
  dayOfMonth: z.number().min(1).max(28).default(15),
});

export type Rebalance = z.infer<typeof RebalanceSchema>;

/**
 * ---- Root Strategy Schema ----
 * The complete strategy configuration
 */
export const StrategySchema = z.object({
  /** Amount to invest each month in USD */
  monthlyInvestmentUsd: z.number().positive(),

  /** Target allocation percentages per asset (must sum to 1.0) */
  allocation: AllocationSchema.refine(
    (alloc) => {
      const total = Object.values(alloc).reduce((a, b) => a + b, 0);
      return Math.abs(total - 1) < 0.0001;
    },
    { message: "Allocation percentages must sum to 1.0" }
  ),

  /** How each asset should be distributed across earn products */
  earnRules: EarnRulesSchema,

  /** Safety constraints (non-negotiable) */
  safety: SafetyRulesSchema,

  /** Execution schedule */
  schedule: ScheduleSchema,

  /** Yearly rebalancing configuration (compulsory) */
  rebalance: RebalanceSchema,
});

export type Strategy = z.infer<typeof StrategySchema>;

/**
 * ---- Validation Helper ----
 * Parse and validate a strategy configuration
 */
export function parseStrategy(data: unknown): Strategy {
  return StrategySchema.parse(data);
}

/**
 * ---- Safe Parse Helper ----
 * Parse strategy without throwing, returns result object
 */
export function safeParseStrategy(data: unknown) {
  return StrategySchema.safeParse(data);
}
