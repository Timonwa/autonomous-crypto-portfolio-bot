import type { RebalanceResult, RunResult } from "@bot/core";

/**
 * ---- Alert Adapter Interface ----
 * Abstraction layer for notification operations.
 * Telegram is the reference implementation.
 */
export interface AlertAdapter {
  /**
   * Send notification that a run has started.
   */
  sendRunStarted(runType: "monthly_investment" | "yearly_rebalance"): Promise<void>;

  /**
   * Send notification that a run completed successfully.
   */
  sendRunCompleted(result: RunResult): Promise<void>;

  /**
   * Send notification that a rebalance completed.
   * Includes details about assets bought/sold.
   */
  sendRebalanceCompleted(result: RebalanceResult): Promise<void>;

  /**
   * Send error notification.
   */
  sendError(error: Error, context?: string): Promise<void>;

  /**
   * Send a custom message.
   */
  sendMessage(message: string): Promise<void>;

  /**
   * Send anomaly detection alert.
   * Used when something unexpected is detected.
   */
  sendAnomaly(description: string, severity: "low" | "medium" | "high"): Promise<void>;

  /**
   * Check if alerts are properly configured and working.
   */
  validateConnection(): Promise<{ valid: boolean; error?: string }>;
}

/**
 * ---- Alert Adapter Options ----
 */
export interface AlertAdapterOptions {
  /** Telegram bot token */
  botToken: string;
  /** Telegram chat ID to send messages to */
  chatId: string;
}

/**
 * ---- Alert Message Templates ----
 * Standardized message formats for different alert types.
 */
export interface AlertTemplates {
  runStarted: (runType: string) => string;
  runCompleted: (result: RunResult) => string;
  rebalanceCompleted: (result: RebalanceResult) => string;
  error: (error: Error, context?: string) => string;
  anomaly: (description: string, severity: string) => string;
}
