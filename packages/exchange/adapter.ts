import type {
  AssetBalance,
  AssetSymbol,
  EarnPosition,
  EarnResult,
  TradeOrder,
  TradeResult,
} from "@bot/core";

/**
 * ---- Exchange Adapter Interface ----
 * Abstraction layer for exchange operations.
 * Binance is the reference implementation.
 */
export interface ExchangeAdapter {
  /**
   * Get current balances for all tracked assets.
   * Includes both spot and earn balances.
   */
  getBalances(): Promise<AssetBalance[]>;

  /**
   * Get current earn positions (staking, locked, flex).
   */
  getEarnPositions(): Promise<EarnPosition[]>;

  /**
   * Get current price of an asset in USDT.
   */
  getPrice(asset: AssetSymbol): Promise<number>;

  /**
   * Execute a market buy order.
   * Used for monthly investments.
   */
  executeBuy(order: TradeOrder): Promise<TradeResult>;

  /**
   * Execute a market sell order.
   * Only used during yearly rebalancing.
   */
  executeSell(order: TradeOrder): Promise<TradeResult>;

  /**
   * Subscribe to an earn product (staking, locked, or flex).
   * Returns the representative token issued (if any).
   */
  subscribeEarn(
    asset: AssetSymbol,
    productType: "staking" | "locked" | "flex",
    amount: number
  ): Promise<EarnResult>;

  /**
   * Redeem from a flexible earn product.
   * Cannot redeem from locked products before maturity.
   */
  redeemFlex(asset: AssetSymbol, amount: number): Promise<EarnResult>;

  /**
   * Check if the adapter is in dry-run mode.
   * In dry-run mode, no actual trades are executed.
   */
  isDryRun(): boolean;

  /**
   * Get exchange-specific minimum order amounts.
   */
  getMinOrderAmount(asset: AssetSymbol): Promise<number>;

  /**
   * Validate API connection and permissions.
   */
  validateConnection(): Promise<{ valid: boolean; error?: string }>;
}

/**
 * ---- Exchange Adapter Options ----
 */
export interface ExchangeAdapterOptions {
  /** API key */
  apiKey: string;
  /** API secret */
  apiSecret: string;
  /** Enable dry-run mode (no real trades) */
  dryRun?: boolean;
  /** Request timeout in milliseconds */
  timeout?: number;
}
