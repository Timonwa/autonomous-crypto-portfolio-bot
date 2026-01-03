/**
 * ---- Asset Symbol ----
 * Type alias for cryptocurrency symbols.
 * Using string for flexibility - validation happens at strategy layer.
 */
export type AssetSymbol = string;

/**
 * ---- Token Category ----
 * Distinguishes between different types of tokens
 */
export type TokenCategory =
  | "base" // Regular tradable assets (BTC, ETH, SOL, BNB, USDT)
  | "liquid_staking" // Tradable staking derivatives (WBETH, BNSOL) - represent staking exposure
  | "non_tradable"; // Non-tradable wrappers (RWUSD) - must be redeemed, not in portfolio

/**
 * ---- Asset Balance ----
 * Current holdings of a single asset
 */
export interface AssetBalance {
  /** Asset symbol (BTC, ETH, etc.) */
  asset: AssetSymbol;
  /** Category of this token */
  category: TokenCategory;
  /** Free balance available for trading/earn */
  free: number;
  /** Locked balance (in orders, earn products, etc.) */
  locked: number;
  /** Total balance (free + locked) */
  total: number;
  /** Estimated value in USD */
  usdValue: number;
  /**
   * For liquid staking derivatives: the base asset this represents exposure to
   * e.g., WBETH -> ETH, BNSOL -> SOL
   */
  representsExposureTo?: AssetSymbol;
}

/**
 * ---- Earn Position ----
 * Current position in an earn product (staking, locked, flex)
 */
export interface EarnPosition {
  /** Asset symbol */
  asset: AssetSymbol;
  /** Type of earn product */
  productType: "staking" | "locked" | "flex";
  /** Product ID on exchange */
  productId: string;
  /** Amount subscribed */
  amount: number;
  /** Annual percentage rate (for reference, not decision-making) */
  apr: number;
  /** For locked products: days remaining until unlock */
  daysRemaining?: number;
  /** For locked products: unlock date */
  unlockDate?: Date;
  /** Whether this position can be redeemed early */
  canRedeem: boolean;
  /**
   * For liquid staking: the derivative token issued (e.g., WBETH for ETH staking)
   * These are tradable and represent your staking exposure.
   * Trading them = exiting staking exposure.
   */
  liquidStakingToken?: AssetSymbol;
  /** Amount of liquid staking tokens received */
  liquidStakingTokenAmount?: number;
  /**
   * For non-tradable products: the wrapper token issued (e.g., RWUSD)
   * These CANNOT be traded - must be redeemed first.
   * Never count these as portfolio assets.
   */
  nonTradableWrapper?: AssetSymbol;
  /** Amount locked in non-tradable wrapper */
  nonTradableWrapperAmount?: number;
}

/**
 * ---- Portfolio Snapshot ----
 * Point-in-time state of the entire portfolio
 */
export interface PortfolioSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Timestamp of snapshot */
  timestamp: Date;
  /** Total portfolio value in USD */
  totalValueUsd: number;
  /** Balances per asset */
  balances: AssetBalance[];
  /** Earn positions */
  earnPositions: EarnPosition[];
  /** Current allocation percentages */
  allocationPercentages: Record<AssetSymbol, number>;
}

/**
 * ---- Trade Order ----
 * Representation of a buy or sell order
 */
export interface TradeOrder {
  /** Order type */
  side: "buy" | "sell";
  /** Asset to trade */
  asset: AssetSymbol;
  /** Quote asset (usually USDT) */
  quoteAsset: "USDT";
  /** Amount in quote asset (for buy) or base asset (for sell) */
  amount: number;
  /** Order type - always market for this bot */
  orderType: "market";
}

/**
 * ---- Trade Result ----
 * Result of an executed trade
 */
export interface TradeResult {
  /** Whether the trade succeeded */
  success: boolean;
  /** Exchange order ID */
  orderId?: string;
  /** Executed quantity of base asset */
  executedQty?: number;
  /** Average fill price */
  avgPrice?: number;
  /** Total cost/proceeds in quote asset */
  quoteQty?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * ---- Earn Subscription Result ----
 * Result of subscribing to an earn product
 */
export interface EarnResult {
  /** Whether the subscription succeeded */
  success: boolean;
  /** Position ID on exchange */
  positionId?: string;
  /** Amount subscribed */
  amount?: number;
  /**
   * Liquid staking derivative issued (tradable, represents staking exposure)
   * e.g., WBETH, BNSOL
   */
  liquidStakingToken?: AssetSymbol;
  /** Amount of liquid staking tokens received */
  liquidStakingTokenAmount?: number;
  /**
   * Non-tradable wrapper issued (must be redeemed, not tradable)
   * e.g., RWUSD
   */
  nonTradableWrapper?: AssetSymbol;
  /** Amount locked in non-tradable wrapper */
  nonTradableWrapperAmount?: number;
  /** Error message if failed */
  error?: string;
}

/**
 * ---- Action ----
 * A single action taken by the bot (for audit trail)
 */
export type ActionType = "buy" | "sell" | "earn_subscribe" | "earn_redeem";

export interface Action {
  /** Unique action ID */
  id: string;
  /** Type of action */
  type: ActionType;
  /** Asset involved */
  asset: AssetSymbol;
  /** Amount involved */
  amount: number;
  /** Timestamp of action */
  timestamp: Date;
  /** Whether action succeeded */
  success: boolean;
  /** Additional details */
  details: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

/**
 * ---- Run Result ----
 * Summary of a bot execution run
 */
export type RunType = "monthly_investment" | "yearly_rebalance";

export interface RunResult {
  /** Unique run ID */
  id: string;
  /** Type of run */
  type: RunType;
  /** Start timestamp */
  startedAt: Date;
  /** End timestamp */
  completedAt: Date;
  /** Whether the run succeeded overall */
  success: boolean;
  /** Portfolio snapshot before run */
  snapshotBefore: PortfolioSnapshot;
  /** Portfolio snapshot after run */
  snapshotAfter: PortfolioSnapshot;
  /** Actions taken during run */
  actions: Action[];
  /** Total invested this run (for monthly) */
  totalInvestedUsd?: number;
  /** Summary message */
  summary: string;
  /** Errors encountered */
  errors: string[];
}

/**
 * ---- Rebalance Result ----
 * Outcome of yearly rebalancing
 */
export interface RebalanceResult {
  /** Run result details */
  runResult: RunResult;
  /** Assets that were over-allocated (sold) */
  soldAssets: Array<{
    asset: AssetSymbol;
    amountSold: number;
    previousPercentage: number;
    targetPercentage: number;
  }>;
  /** Assets that were under-allocated (bought) */
  boughtAssets: Array<{
    asset: AssetSymbol;
    amountBought: number;
    previousPercentage: number;
    targetPercentage: number;
  }>;
  /** Assets within tolerance (no action) */
  unchangedAssets: AssetSymbol[];
  /** Whether rebalance was needed */
  rebalanceNeeded: boolean;
}

/**
 * ---- Validation Result ----
 * Result of AI validation of planned actions
 */
export interface ValidationResult {
  /** Whether the plan is valid */
  isValid: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Warnings (non-blocking) */
  warnings: string[];
  /** Errors (blocking) */
  errors: string[];
  /** Suggestions for improvement */
  suggestions: string[];
}
