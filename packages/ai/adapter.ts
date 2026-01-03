import type {
  Action,
  PortfolioSnapshot,
  RunResult,
  ValidationResult,
} from "@bot/core";

/**
 * ---- AI Adapter Interface ----
 * Abstraction layer for AI-powered insights.
 *
 * IMPORTANT: AI is advisory only. It must never:
 * - Select assets
 * - Change allocations
 * - Execute trades
 * - Override rules
 */
export interface AIAdapter {
  /**
   * Validate a planned set of actions before execution.
   * Returns warnings/errors but does NOT block execution.
   */
  validatePlan(actions: Action[]): Promise<ValidationResult>;

  /**
   * Generate a human-readable summary of a completed run.
   */
  summarizeRun(result: RunResult): Promise<string>;

  /**
   * Generate insights about the current portfolio state.
   * For display on dashboard only.
   */
  generateInsights(snapshot: PortfolioSnapshot): Promise<PortfolioInsight[]>;

  /**
   * Detect anomalies in portfolio or execution.
   * Returns descriptions of anything unusual.
   */
  detectAnomalies(
    currentSnapshot: PortfolioSnapshot,
    previousSnapshot: PortfolioSnapshot | null
  ): Promise<AnomalyDetection[]>;

  /**
   * Check if AI service is available and responding.
   */
  isAvailable(): Promise<boolean>;
}

/**
 * ---- Portfolio Insight ----
 * AI-generated observation about the portfolio.
 */
export interface PortfolioInsight {
  /** Category of insight */
  category: "allocation" | "performance" | "risk" | "opportunity" | "general";
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Timestamp when insight was generated */
  generatedAt: Date;
}

/**
 * ---- Anomaly Detection ----
 * AI-detected unusual pattern or state.
 */
export interface AnomalyDetection {
  /** Type of anomaly */
  type:
    | "price_movement"
    | "balance_discrepancy"
    | "execution_failure"
    | "unexpected_state";
  /** Severity level */
  severity: "low" | "medium" | "high";
  /** Description of the anomaly */
  description: string;
  /** Recommended action (for human review) */
  recommendation?: string;
  /** Timestamp when detected */
  detectedAt: Date;
}

/**
 * ---- AI Adapter Options ----
 */
export interface AIAdapterOptions {
  /** API key for AI service */
  apiKey: string;
  /** Model to use */
  model?: string;
  /** Temperature for generation (0-1) */
  temperature?: number;
  /** Maximum tokens for responses */
  maxTokens?: number;
}
