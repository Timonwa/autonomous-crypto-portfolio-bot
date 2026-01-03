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

/**
 * ---- Earn Rules ----
 * How each asset is split across earn products
 */
export const EarnSplitSchema = z.object({
  staking: z.number().min(0).max(1).optional(),
  locked: z.number().min(0).max(1).optional(),
  flex: z.number().min(0).max(1).optional(),
});

export const EarnRulesSchema = z.record(AssetSymbol, EarnSplitSchema);

/**
 * ---- Safety Constraints ----
 */
export const SafetyRulesSchema = z.object({
  maxLockedPercentage: z.number().min(0).max(1).default(0.8),
  minFlexPercentage: z.number().min(0).max(1).default(0.2),
  allowSell: z.literal(false),
  allowFutures: z.literal(false),
  allowMargin: z.literal(false),
  allowStructuredProducts: z.literal(false),
});

/**
 * ---- Bot Schedule ----
 */
export const ScheduleSchema = z.object({
  type: z.literal("cron"),
  expression: z.string(), // e.g. "0 9 1 * *"
});

/**
 * ---- Root Strategy Schema ----
 */
export const StrategySchema = z.object({
  monthlyInvestmentUsd: z.number().positive(),

  allocation: AllocationSchema.refine(
    (alloc) => {
      const total = Object.values(alloc).reduce((a, b) => a + b, 0);
      return Math.abs(total - 1) < 0.0001;
    },
    { message: "Allocation must sum to 1.0" }
  ),

  earnRules: EarnRulesSchema,

  safety: SafetyRulesSchema,

  schedule: ScheduleSchema,
});

export type Strategy = z.infer<typeof StrategySchema>;
