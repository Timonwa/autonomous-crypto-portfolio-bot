import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { type Strategy, StrategySchema } from "./schema";

/**
 * ---- Strategy Loader ----
 * Loads strategy from either config file or database based on feature flags.
 *
 * Rules:
 * - strategySource = "file" → Load from config/strategy.yaml
 * - strategySource = "database" → Load from storage adapter
 * - Never merge both sources
 * - Fail fast on invalid configuration
 */

/**
 * Feature flags subset needed by the loader.
 * Avoids circular dependency with @bot/flags.
 */
export interface StrategyLoaderFlags {
  ui: {
    enabled: boolean;
    strategyEditing: boolean;
  };
  storage: {
    enabled: boolean;
  };
}

/**
 * Storage adapter interface subset needed by the loader.
 * Avoids circular dependency with @bot/storage.
 */
export interface StrategyStorageAdapter {
  getStrategy(): Promise<Strategy | null>;
}

export interface StrategyLoaderOptions {
  /** Feature flags to determine source */
  flags: StrategyLoaderFlags;
  /** Storage adapter (required if strategySource = "database") */
  storage?: StrategyStorageAdapter;
  /** Custom config file path (optional, defaults to config/strategy.yaml) */
  configPath?: string;
}

/**
 * Load strategy from the appropriate source.
 * @throws Error if configuration is invalid or source is unavailable
 */
export async function loadStrategy(options: StrategyLoaderOptions): Promise<Strategy> {
  const { flags, storage, configPath } = options;

  // Determine source
  const source = resolveSource(flags);

  if (source === "database") {
    return loadFromDatabase(storage);
  }

  return loadFromFile(configPath);
}

/**
 * Resolve the effective strategy source from flags.
 */
function resolveSource(flags: StrategyLoaderFlags): "file" | "database" {
  // If UI editing is enabled with storage, use database
  if (flags.ui.enabled && flags.ui.strategyEditing && flags.storage.enabled) {
    return "database";
  }

  // Otherwise, always use file
  return "file";
}

/**
 * Load strategy from YAML config file.
 */
function loadFromFile(customPath?: string): Strategy {
  // Determine config path
  const configPath = customPath ?? getDefaultConfigPath();

  // Check file exists
  if (!existsSync(configPath)) {
    throw new Error(`Strategy config file not found: ${configPath}`);
  }

  // Read and parse YAML
  const fileContent = readFileSync(configPath, "utf-8");
  const rawConfig = parseYaml(fileContent);

  // Validate against schema
  const result = StrategySchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid strategy configuration:\n${errors}`);
  }

  return result.data;
}

/**
 * Load strategy from database via storage adapter.
 */
async function loadFromDatabase(storage?: StrategyStorageAdapter): Promise<Strategy> {
  if (!storage) {
    throw new Error(
      "Storage adapter is required when strategySource='database'. " +
        "Either provide a storage adapter or set strategySource='file'."
    );
  }

  const strategy = await storage.getStrategy();

  if (!strategy) {
    throw new Error(
      "No strategy found in database. " +
        "Please create a strategy via the UI or migrate from config file."
    );
  }

  // Re-validate (in case DB data was corrupted)
  const result = StrategySchema.safeParse(strategy);

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `  - ${e.path.join(".")}: ${e.message}`)
      .join("\n");
    throw new Error(`Invalid strategy in database:\n${errors}`);
  }

  return result.data;
}

/**
 * Get the default config file path.
 * Works from any location in the monorepo.
 */
function getDefaultConfigPath(): string {
  // Try relative to current working directory
  const cwdPath = join(process.cwd(), "config", "strategy.yaml");
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  // Try relative to this file (for when running from packages)
  const packagePath = join(__dirname, "..", "..", "..", "config", "strategy.yaml");
  if (existsSync(packagePath)) {
    return packagePath;
  }

  // Default to cwd path (will fail with clear error)
  return cwdPath;
}

/**
 * Validate a strategy object without loading from any source.
 * Useful for validating user input before saving.
 */
export function validateStrategy(data: unknown): {
  valid: boolean;
  strategy?: Strategy;
  errors?: string[];
} {
  const result = StrategySchema.safeParse(data);

  if (result.success) {
    return { valid: true, strategy: result.data };
  }

  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
}
