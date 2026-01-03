import { z } from "zod";

/**
 * ---- Core Domain Types ----
 */

/**
 * Asset symbols are FULLY DYNAMIC - not hardcoded enums.
 * Users can define any cryptocurrency and its derivatives via configuration.
 *
 * Token Categories:
 *   - base: Regular tradable cryptocurrencies (BTC, ETH, SOL, etc.)
 *   - liquid_staking: Tradable tokens representing staking exposure (WBETH, BNSOL)
 *   - non_tradable: Must be redeemed, not counted in portfolio (RWUSD)
 *
 * All token relationships are defined in the strategy config file.
 */
export const AssetSymbol = z
  .string()
  .min(1, "Asset symbol cannot be empty")
  .max(20, "Asset symbol too long")
  .regex(/^[A-Z0-9]+$/, "Asset symbol must be uppercase alphanumeric");

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
    split => {
      const total =
        (split.staking ?? 0) + (split.locked ?? 0) + (split.flex ?? 0);
      return total <= 1.0001; // Allow small floating point error
    },
    { message: "Earn split percentages must not exceed 1.0" }
  );

export type EarnSplit = z.infer<typeof EarnSplitSchema>;

export const EarnRulesSchema = z.record(AssetSymbol, EarnSplitSchema);

export type EarnRules = z.infer<typeof EarnRulesSchema>;

/**
 * ---- Staking Derivatives ----
 * Unified configuration for all derivative tokens (liquid staking + non-tradable).
 * This is FULLY CONFIGURABLE - users define their own derivatives.
 *
 * Types:
 *   - liquid: Tradable derivatives (WBETH, BNSOL) - trading exits staking
 *   - non_tradable: Must redeem first (RWUSD) - cannot trade directly
 *
 * Example Configuration:
 *   stakingDerivatives:
 *     ETH:
 *       symbol: WBETH
 *       type: liquid
 *       description: "Wrapped staked ETH"
 *     SOL:
 *       symbol: BNSOL
 *       type: liquid
 *     USDT:
 *       symbol: RWUSD
 *       type: non_tradable
 *       redeemsTo: USDC
 */
export const StakingDerivativeTypeSchema = z.enum(["liquid", "non_tradable"]);

export type StakingDerivativeType = z.infer<typeof StakingDerivativeTypeSchema>;

export const StakingDerivativeSchema = z.object({
  /** The derivative token symbol (e.g., WBETH, BNSOL, RWUSD) */
  symbol: AssetSymbol,
  /** Type of derivative: liquid (tradable) or non_tradable (must redeem) */
  type: StakingDerivativeTypeSchema,
  /** For non_tradable: which asset it redeems to (e.g., RWUSD → USDC) */
  redeemsTo: AssetSymbol.optional(),
  /** Optional human-readable description */
  description: z.string().optional(),
});

export type StakingDerivative = z.infer<typeof StakingDerivativeSchema>;

/**
 * Map of base assets to their staking derivatives.
 * Key: base asset symbol (e.g., ETH, SOL, USDT)
 * Value: derivative configuration
 */
export const StakingDerivativesSchema = z.record(
  AssetSymbol,
  StakingDerivativeSchema
);

export type StakingDerivatives = z.infer<typeof StakingDerivativesSchema>;

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
  /**
   * Allow trading liquid staking derivatives (WBETH, BNSOL).
   * Trading these = exiting staking exposure.
   * Should only be true during:
   *   - Yearly rebalancing
   *   - Explicit strategy changes
   * NEVER true during normal monthly runs.
   */
  allowLiquidStakingTrades: z.boolean().default(false),
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
  expression: z
    .string()
    .regex(/^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+$/, {
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
    alloc => {
      const total = Object.values(alloc).reduce((a, b) => a + b, 0);
      return Math.abs(total - 1) < 0.0001;
    },
    { message: "Allocation percentages must sum to 1.0" }
  ),

  /** How each asset should be distributed across earn products */
  earnRules: EarnRulesSchema,

  /**
   * Staking derivatives configuration.
   * Maps base assets to their derivative tokens.
   * FULLY CONFIGURABLE - users can define any asset's derivatives.
   *
   * Types:
   *   - liquid: Tradable derivatives (WBETH, BNSOL) - trading exits staking
   *   - non_tradable: Must redeem first (RWUSD) - cannot trade directly
   *
   * Example:
   *   stakingDerivatives:
   *     ETH: { symbol: WBETH, type: liquid }
   *     USDT: { symbol: RWUSD, type: non_tradable, redeemsTo: USDC }
   */
  stakingDerivatives: StakingDerivativesSchema.optional(),

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
