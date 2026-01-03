/**
 * ---- Exposure Utilities ----
 * Handles the relationship between base assets and their staking derivatives.
 *
 * ALL MAPPINGS ARE CONFIG-DRIVEN - no hardcoded symbols.
 * The strategy configuration defines:
 *   - Which assets have staking derivatives
 *   - Whether derivatives are liquid (tradable) or non_tradable
 *   - Redemption paths for non_tradable derivatives
 *
 * Key Rules:
 * 1. Base asset + liquid derivative = same exposure (never both active)
 * 2. If liquid staking derivative exists, base asset (spot) is effectively zero
 * 3. Trading liquid staking derivatives = exiting staking exposure
 * 4. Non-tradable derivatives must be redeemed first, never counted in portfolio
 */

import type { AssetBalance, AssetSymbol, TokenCategory } from "./types";

/**
 * Staking derivative configuration (matches schema.ts).
 */
export interface StakingDerivative {
  symbol: AssetSymbol;
  type: "liquid" | "non_tradable";
  redeemsTo?: AssetSymbol;
  description?: string;
}

/**
 * Complete staking derivatives configuration map.
 * Key: base asset symbol (e.g., ETH, SOL)
 * Value: derivative configuration
 */
export type StakingDerivativesConfig = Record<AssetSymbol, StakingDerivative>;

/**
 * Create lookup maps from staking derivatives configuration.
 * Returns:
 *   - derivativeToBase: derivative symbol → base asset symbol
 *   - baseToDerivative: base asset symbol → derivative symbol
 *   - liquidDerivatives: Set of liquid staking derivative symbols
 *   - nonTradableDerivatives: Set of non-tradable derivative symbols
 *   - redemptionMap: non-tradable derivative → redeems to asset
 */
export function createDerivativeLookups(
  config: StakingDerivativesConfig | undefined
): {
  derivativeToBase: Map<AssetSymbol, AssetSymbol>;
  baseToDerivative: Map<AssetSymbol, AssetSymbol>;
  liquidDerivatives: Set<AssetSymbol>;
  nonTradableDerivatives: Set<AssetSymbol>;
  redemptionMap: Map<AssetSymbol, AssetSymbol>;
} {
  const derivativeToBase = new Map<AssetSymbol, AssetSymbol>();
  const baseToDerivative = new Map<AssetSymbol, AssetSymbol>();
  const liquidDerivatives = new Set<AssetSymbol>();
  const nonTradableDerivatives = new Set<AssetSymbol>();
  const redemptionMap = new Map<AssetSymbol, AssetSymbol>();

  if (!config) {
    return {
      derivativeToBase,
      baseToDerivative,
      liquidDerivatives,
      nonTradableDerivatives,
      redemptionMap,
    };
  }

  for (const [baseAsset, derivative] of Object.entries(config)) {
    derivativeToBase.set(derivative.symbol, baseAsset);
    baseToDerivative.set(baseAsset, derivative.symbol);

    if (derivative.type === "liquid") {
      liquidDerivatives.add(derivative.symbol);
    } else {
      nonTradableDerivatives.add(derivative.symbol);
      if (derivative.redeemsTo) {
        redemptionMap.set(derivative.symbol, derivative.redeemsTo);
      }
    }
  }

  return {
    derivativeToBase,
    baseToDerivative,
    liquidDerivatives,
    nonTradableDerivatives,
    redemptionMap,
  };
}

/**
 * Exposure utilities class that uses config-driven lookups.
 * Initialize with your strategy's staking derivatives config.
 */
export class ExposureUtils {
  private readonly derivativeToBase: Map<AssetSymbol, AssetSymbol>;
  private readonly baseToDerivative: Map<AssetSymbol, AssetSymbol>;
  private readonly liquidDerivatives: Set<AssetSymbol>;
  private readonly nonTradableDerivatives: Set<AssetSymbol>;
  private readonly redemptionMap: Map<AssetSymbol, AssetSymbol>;

  constructor(config: StakingDerivativesConfig | undefined) {
    const lookups = createDerivativeLookups(config);
    this.derivativeToBase = lookups.derivativeToBase;
    this.baseToDerivative = lookups.baseToDerivative;
    this.liquidDerivatives = lookups.liquidDerivatives;
    this.nonTradableDerivatives = lookups.nonTradableDerivatives;
    this.redemptionMap = lookups.redemptionMap;
  }

  /**
   * Get the token category for an asset.
   */
  getTokenCategory(asset: AssetSymbol): TokenCategory {
    if (this.liquidDerivatives.has(asset)) {
      return "liquid_staking";
    }
    if (this.nonTradableDerivatives.has(asset)) {
      return "non_tradable";
    }
    return "base";
  }

  /**
   * Get the base asset for a staking derivative.
   * Returns undefined if not a derivative.
   */
  getBaseAsset(derivative: AssetSymbol): AssetSymbol | undefined {
    return this.derivativeToBase.get(derivative);
  }

  /**
   * Get the staking derivative for a base asset.
   * Returns undefined if asset doesn't have a derivative.
   */
  getDerivative(baseAsset: AssetSymbol): AssetSymbol | undefined {
    return this.baseToDerivative.get(baseAsset);
  }

  /**
   * Check if an asset is a liquid staking derivative.
   */
  isLiquidStakingDerivative(asset: AssetSymbol): boolean {
    return this.liquidDerivatives.has(asset);
  }

  /**
   * Check if an asset is non-tradable (must be redeemed).
   */
  isNonTradable(asset: AssetSymbol): boolean {
    return this.nonTradableDerivatives.has(asset);
  }

  /**
   * Get the redemption asset for a non-tradable derivative.
   */
  getRedemptionAsset(derivative: AssetSymbol): AssetSymbol | undefined {
    return this.redemptionMap.get(derivative);
  }

  /**
   * Calculate effective exposure for a base asset.
   * Combines spot holdings with any liquid staking derivative holdings.
   */
  calculateEffectiveExposure(
    baseAsset: AssetSymbol,
    balances: AssetBalance[]
  ): {
    totalExposure: number;
    spotAmount: number;
    stakedAmount: number;
    derivativeToken?: AssetSymbol;
    derivativeAmount?: number;
  } {
    const spotBalance = balances.find(b => b.asset === baseAsset);
    const derivative = this.getDerivative(baseAsset);
    const derivativeBalance = derivative
      ? balances.find(b => b.asset === derivative)
      : undefined;

    const spotAmount = spotBalance?.total ?? 0;
    const derivativeAmount = derivativeBalance?.total ?? 0;
    const stakedAmount = derivativeAmount;

    return {
      totalExposure: spotAmount + stakedAmount,
      spotAmount,
      stakedAmount,
      derivativeToken: derivative,
      derivativeAmount: derivativeAmount > 0 ? derivativeAmount : undefined,
    };
  }

  /**
   * Filter balances to exclude non-tradable wrappers.
   * These should NEVER be counted in portfolio calculations.
   */
  filterTradableBalances(balances: AssetBalance[]): AssetBalance[] {
    return balances.filter(b => !this.isNonTradable(b.asset));
  }

  /**
   * Check if trading a liquid staking derivative is allowed.
   */
  canTradeLiquidStakingDerivative(
    asset: AssetSymbol,
    allowLiquidStakingTrades: boolean
  ): { allowed: boolean; reason?: string } {
    if (!this.isLiquidStakingDerivative(asset)) {
      return { allowed: true };
    }

    if (!allowLiquidStakingTrades) {
      const baseAsset = this.getBaseAsset(asset);
      return {
        allowed: false,
        reason:
          `Trading ${asset} is not allowed during normal runs. ` +
          `${asset} represents staking exposure for ${baseAsset}. ` +
          `Trading is only allowed during yearly rebalancing or strategy changes.`,
      };
    }

    return { allowed: true };
  }

  /**
   * Determine the correct asset to trade when rebalancing.
   */
  determineTradeAsset(
    baseAsset: AssetSymbol,
    side: "buy" | "sell",
    balances: AssetBalance[]
  ): {
    asset: AssetSymbol;
    isDerivative: boolean;
    reason: string;
  } {
    const derivative = this.getDerivative(baseAsset);
    const derivativeBalance = derivative
      ? balances.find(b => b.asset === derivative)
      : undefined;

    if (side === "buy") {
      return {
        asset: baseAsset,
        isDerivative: false,
        reason: `Buying ${baseAsset} directly. Stake later to get ${
          derivative ?? "derivative"
        }.`,
      };
    }

    if (derivativeBalance && derivativeBalance.total > 0 && derivative) {
      return {
        asset: derivative,
        isDerivative: true,
        reason:
          `Selling ${derivative} first (liquid staking derivative). ` +
          `This exits staking exposure without unstake period.`,
      };
    }

    return {
      asset: baseAsset,
      isDerivative: false,
      reason: `Selling spot ${baseAsset}. No ${
        derivative ?? "derivative"
      } holdings.`,
    };
  }
}
