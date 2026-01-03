# Implementation Plan

## Autonomous Crypto Portfolio Bot

This document outlines the phased approach to building the Autonomous Crypto Portfolio Bot based on the PRD and agent.md specifications.

---

## Current State

### ✅ Completed

- **Monorepo structure** - pnpm workspaces with apps and packages
- **TypeScript configuration** - Base config with project references
- **Biome setup** - Linting, formatting, import organization
- **Strategy schema** - Zod validation for configuration (partial)
- **Folder structure** - All directories and placeholder files created
- **Feature flags** - Strategy source resolution and validation

### 📁 Project Structure

```
/apps
  /bot-runner          # Main bot execution
  /dashboard           # Next.js UI (Phase 1: read-only, Phase 2: strategy editing)

/packages
  /core                # Core business logic
  /strategy            # Config validation & loading
  /exchange            # Binance adapter
  /storage             # Persistence layer
  /alerts              # Telegram notifications
  /ai                  # Optional AI insights
  /flags               # Feature flags

/config                # YAML configuration files
/scripts               # Utility scripts
/docs                  # Documentation
```

---

## Key Features

### 1. Monthly Investment (Core)

- Runs on a fixed schedule (e.g., 3rd of each month)
- Buys assets according to allocation percentages
- Allocates to earn products (staking/locked/flex)

### 2. Yearly Rebalancing (Compulsory)

- Runs every January (configurable day)
- Checks if holdings are +/- 5% off target allocation
- Sells over-allocated assets, buys under-allocated ones
- Only time selling is permitted
- Can trade liquid staking derivatives (with `allowLiquidStakingTrades: true`)

### 3. Staking Derivatives Handling

Exchange staking may issue **derivative tokens** to represent staked positions. The system handles these with fully configurable mappings.

#### Derivative Types

| Type | Examples | Behavior |
|------|----------|----------|
| `liquid` | WBETH, BNSOL | Tradable. Trading = exiting staking exposure |
| `non_tradable` | RWUSD | Must redeem first. Never count in portfolio |

#### Key Rules

1. **Base asset + liquid derivative = same exposure** (never both active)
2. **Liquid derivatives are tradable** but only during rebalancing
3. **Non-tradable wrappers are excluded** from portfolio calculations
4. **Configuration is dynamic** - users define their own derivatives

#### Configuration Example

```yaml
stakingDerivatives:
  ETH:
    symbol: WBETH
    type: liquid
  SOL:
    symbol: BNSOL
    type: liquid
  USDT:
    symbol: RWUSD
    type: non_tradable
    redeemsTo: USDC
```

#### Exposure Calculation

- When calculating ETH exposure: `spot ETH + WBETH holdings = total ETH exposure`
- When calculating SOL exposure: `spot SOL + BNSOL holdings = total SOL exposure`
- RWUSD is **never** counted in portfolio (must redeem to USDC first)

### 4. Strategy Editing via UI (Optional - Phase 2)

- Requires read-only dashboard to be complete first
- Allows updating allocation percentages via web UI
- Strategy stored in database instead of config file

---

## Strategy Source Logic

The strategy can come from **either** config file **or** database — never both.

| Scenario | Modules Enabled | Strategy Source | Notes |
|----------|-----------------|-----------------|-------|
| Bot-only | core | `file` | No UI, no DB |
| Bot + Storage | core + storage | `file` | DB for logs only |
| Bot + Storage + UI (read-only) | core + storage + ui | `file` | Phase 1 dashboard |
| Bot + Storage + UI (editing) | core + storage + ui (strategyEditing=true) | `database` | Phase 2 dashboard |

**Key Rules:**

- `strategySource: database` is ONLY valid when UI editing is enabled AND storage is enabled
- The bot NEVER merges file and database strategies
- One source. One truth.
- Fail fast if invalid configuration detected

---

## Implementation Phases

### Phase 1: Foundation (Core Types & Interfaces)

**Goal:** Establish domain types and adapter interfaces that all modules depend on.

#### Tasks

1. **Define core domain types** (`packages/core/types.ts`)
   - `AssetBalance` - Current holdings per asset (includes `category` and `representsExposureTo`)
   - `PortfolioSnapshot` - Point-in-time portfolio state
   - `EarnPosition` - Staking/locked/flex positions (includes liquid staking derivative info)
   - `TradeOrder` - Buy/sell order representation
   - `RunResult` - Execution summary
   - `Action` - Recorded action (buy, sell, subscribe, etc.)
   - `RebalanceResult` - Yearly rebalancing outcome
   - `TokenCategory` - "base" | "liquid_staking" | "non_tradable"

2. **Implement exposure utilities** (`packages/core/exposure.ts`)
   - `ExposureUtils` class with config-driven lookups
   - `createDerivativeLookups()` - Build lookup maps from config
   - `getTokenCategory()` - Determine token type
   - `calculateEffectiveExposure()` - Combine base + derivative exposure
   - `filterTradableBalances()` - Exclude non-tradable wrappers
   - `canTradeLiquidStakingDerivative()` - Check if trading is allowed
   - `determineTradeAsset()` - Choose correct asset for rebalancing

3. **Define adapter interfaces**
   - `ExchangeAdapter` (`packages/exchange/adapter.ts`)
     - `getBalances(): Promise<AssetBalance[]>`
     - `getEarnPositions(): Promise<EarnPosition[]>`
     - `executeBuy(order: TradeOrder): Promise<TradeResult>`
     - `executeSell(order: TradeOrder): Promise<TradeResult>` (for rebalancing)
     - `subscribeEarn(asset, product, amount): Promise<EarnResult>`
   - `StorageAdapter` (`packages/storage/adapter.ts`)
     - `saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>`
     - `saveRun(run: RunResult): Promise<void>`
     - `saveAction(action: Action): Promise<void>`
     - `getStrategy(): Promise<Strategy | null>` (for Phase 2)
     - `saveStrategy(strategy: Strategy): Promise<void>` (for Phase 2)
   - `AlertAdapter` (`packages/alerts/adapter.ts`)
     - `sendRunStarted(): Promise<void>`
     - `sendRunCompleted(summary: RunResult): Promise<void>`
     - `sendRebalanceCompleted(result: RebalanceResult): Promise<void>`
     - `sendError(error: Error): Promise<void>`
   - `AIAdapter` (`packages/ai/adapter.ts`)
     - `validatePlan(actions: Action[]): Promise<ValidationResult>`
     - `summarizeRun(run: RunResult): Promise<string>`

4. **Complete strategy schema** (`packages/strategy/schema.ts`)
   - Finalize all Zod schemas
   - Add rebalancing configuration
   - Add refinements and constraints
   - Export inferred TypeScript types

5. **Implement strategy loader** (`packages/strategy/loader.ts`)
   - Load from YAML configuration OR database (based on flags)
   - Validate against schema
   - Return typed configuration

**Deliverables:**

- All core types exported from `@bot/core`
- All adapter interfaces defined
- Strategy loading working with sample config

---

### Phase 2: Core Bot Logic

**Goal:** Implement the decision-making engine.

#### Tasks

1. **Allocator** (`packages/core/allocator.ts`)
   - Calculate target amounts per asset
   - Compute buy amounts based on monthly investment
   - Round to exchange-valid quantities

2. **Earn engine** (`packages/core/earn-engine.ts`)
   - Compute target earn distribution per asset
   - Determine which subscriptions to make
   - Respect liquidity constraints

3. **Reconciler** (`packages/core/reconciler.ts`)
   - Compare current state to targets
   - Generate action plan (buys + earn subscriptions)
   - Handle partial fills and deficits

4. **Rebalancer** (`packages/core/rebalancer.ts`)
   - Check if current month is January (or configured rebalance month)
   - Compare current allocation percentages to targets
   - Identify assets outside +/- tolerance threshold
   - Generate sell orders for over-allocated assets
   - Generate buy orders for under-allocated assets
   - Respect locked positions (cannot sell locked assets)

5. **Guards** (`packages/core/guards.ts`)
   - Validate configuration constraints
   - Check safety rules before execution
   - Fail-fast on violations
   - Special handling: `allowSell` is only permitted during rebalancing

6. **Core barrel export** (`packages/core/index.ts`)
   - Export all modules
   - Provide `executePlan()` function
   - Provide `executeRebalance()` function

**Deliverables:**

- Complete allocation calculation
- Earn distribution logic
- Reconciliation producing action plans
- Yearly rebalancing logic
- Safety guards preventing invalid operations

---

### Phase 3: Exchange Integration (Binance)

**Goal:** Implement the Binance adapter for reading balances and executing trades.

#### Tasks

1. **Binance client setup** (`packages/exchange/binance/client.ts`)
   - API key/secret configuration
   - Signed request handling
   - Error handling and retries

2. **Balance fetching** (`packages/exchange/binance/balances.ts`)
   - Fetch spot balances
   - Fetch earn positions (flexible, locked, staking)
   - Normalize to `AssetBalance` and `EarnPosition`

3. **Trade execution** (`packages/exchange/binance/trades.ts`)
   - Market buy orders
   - Market sell orders (for rebalancing only)
   - Quote calculation (USDT pairs)
   - Order confirmation

4. **Earn operations** (`packages/exchange/binance/earn.ts`)
   - Subscribe to flexible savings
   - Subscribe to locked products
   - Subscribe to staking (where available)
   - Respect minimum amounts

5. **Adapter implementation** (`packages/exchange/binance/index.ts`)
   - Implement `ExchangeAdapter` interface
   - Wire up all Binance operations

**Deliverables:**

- Working Binance adapter
- Can read balances and earn positions
- Can execute buys and earn subscriptions
- Dry-run mode for testing

---

### Phase 4: Bot Runner

**Goal:** Wire everything together into an executable bot.

#### Tasks

1. **Main entry** (`apps/bot-runner/run.ts`)
   - Load configuration (from file or database based on flags)
   - Validate feature flag combinations
   - Initialize adapters
   - Determine run type (monthly investment vs yearly rebalance)
   - Execute reconciliation or rebalancing
   - Run action plan
   - Record results

2. **Lifecycle hooks** (`apps/bot-runner/lifecycle.ts`)
   - `beforeRun()` - Pre-execution checks
   - `afterRun()` - Cleanup and notifications
   - `isRebalanceMonth()` - Check if January (or configured month)
   - Error handling wrapper

3. **Cron wrapper** (`apps/bot-runner/cron.ts`)
   - Vercel cron-compatible handler
   - Environment-based configuration
   - Idempotency checks
   - Support for both monthly and yearly schedules

4. **Feature flags integration** (`packages/flags/`)
   - Define all flags (alerts, storage, AI, strategySource, etc.)
   - Runtime flag resolution
   - Validate flag combinations (fail fast on invalid config)
   - Graceful degradation

**Deliverables:**

- Executable bot with `pnpm run bot:run`
- Cron-compatible endpoint
- Feature flag control over optional modules
- Yearly rebalancing triggered in January

---

### Phase 5: Storage & Persistence

**Goal:** Implement optional persistence for observability.

#### Tasks

1. **Null adapter** (`packages/storage/null.ts`)
   - No-op implementation
   - Used when storage is disabled

2. **Supabase client** (`packages/storage/supabase/client.ts`)
   - Initialize Supabase client
   - Handle auth

3. **Data operations**
   - `runs.ts` - Save/query run history
   - `snapshots.ts` - Save/query portfolio snapshots
   - `actions.ts` - Save/query executed actions
   - `strategy.ts` - Save/query strategy (for Phase 2 UI editing)

4. **Database schema**
   - Create migrations for tables
   - Include `strategies` table for Phase 2
   - Document schema in `/docs`

**Deliverables:**

- Working Supabase adapter
- Historical data storage
- Query capabilities for dashboard

---

### Phase 6: Alerts & Notifications

**Goal:** Implement Telegram notifications.

#### Tasks

1. **Telegram adapter** (`packages/alerts/telegram.ts`)
   - Bot token configuration
   - Message formatting
   - Send notifications

2. **Notification triggers**
   - Run started
   - Run completed (with summary)
   - Run failed (with error details)
   - Rebalance completed (with trades summary)
   - Anomaly detected

**Deliverables:**

- Working Telegram notifications
- Clear, formatted messages
- Optional based on feature flag

---

### Phase 7: Dashboard Phase 1 (Read-Only UI)

**Goal:** Build a Next.js dashboard for observability. **Must be complete before Phase 8.**

#### Tasks

1. **Next.js setup** (`apps/dashboard/`)
   - App router configuration
   - Tailwind CSS styling
   - Environment configuration

2. **Authentication**
   - Magic link (passwordless)
   - Single-user auth guard
   - Middleware protection

3. **API routes** (`apps/dashboard/pages/api/`)
   - `GET /api/portfolio` - Current state
   - `GET /api/history` - Historical snapshots
   - `GET /api/runs` - Run history
   - `GET /api/rebalances` - Rebalance history
   - All routes are **read-only**

4. **UI components**
   - Portfolio overview (pie chart)
   - Historical growth chart
   - Earn distribution breakdown
   - Run history table
   - Action audit log
   - Rebalance history view

5. **Pages**
   - `/` - Dashboard home
   - `/history` - Historical views
   - `/runs` - Run details
   - `/rebalances` - Yearly rebalance history

**Deliverables:**

- Deployed dashboard on Vercel
- Magic link authentication
- Real-time portfolio visibility
- Strategy source: `file` (read-only)

---

### Phase 8: Dashboard Phase 2 (Strategy Editing - Optional)

**Goal:** Allow users to update portfolio strategy via the web UI.

**Prerequisites:**

- Phase 7 (Read-Only UI) must be complete and deployed
- Storage (Supabase) must be enabled

#### Tasks

1. **Strategy API routes**
   - `GET /api/strategy` - Get current strategy
   - `PUT /api/strategy` - Update strategy
   - Validation against Zod schema

2. **Strategy editing UI**
   - Allocation percentage editor
   - Earn rules editor
   - Monthly investment amount editor
   - Validation feedback
   - Confirmation dialog before save

3. **Strategy storage**
   - `packages/storage/supabase/strategy.ts`
   - CRUD operations for strategy
   - Version history (optional)

4. **Feature flag updates**
   - `ui.strategyEditing: true`
   - `strategySource: database`
   - Validation in loader

5. **Migration**
   - Tool to migrate config file to database
   - One-time setup for existing users

**Deliverables:**

- Strategy editing via web UI
- Strategy stored in database
- Config file no longer used (when enabled)
- Clear migration path from file to database

**Important Rules:**

- This feature is **optional**
- Strategy comes from **either** file **or** database, never both
- If `strategySource: database` but UI is disabled → fail fast

---

### Phase 9: AI Integration (Optional)

**Goal:** Add AI-powered insights without affecting execution.

#### Tasks

1. **AI adapter interface** (`packages/ai/adapter.ts`)
   - Define advisory-only methods

2. **ADK-TS integration** (`packages/ai/adk-ts/`)
   - `validator.ts` - Validate planned actions
   - `summarizer.ts` - Generate run summaries
   - `insights.ts` - Portfolio insights

3. **Dashboard integration**
   - Display AI-generated summaries
   - Show validation results
   - Insights widget

**Deliverables:**

- AI validation of action plans
- Human-readable run summaries
- Portfolio insights on dashboard

---

### Phase 10: Scripts & Utilities

**Goal:** Provide developer tooling.

#### Tasks

1. **Dry run script** (`scripts/dry-run.ts`)
   - Execute full flow without trades
   - Print planned actions
   - Validate configuration
   - Test rebalancing logic

2. **Seed script** (`scripts/seed.ts`)
   - Populate test data
   - Create sample snapshots

3. **Migration script** (`scripts/migrate-strategy.ts`)
   - Migrate strategy from config file to database
   - For users upgrading to Phase 8 (strategy editing)

**Deliverables:**

- `pnpm run dry-run` working
- Development utilities
- Strategy migration tool

---

### Phase 11: Documentation & Deployment

**Goal:** Complete documentation and production deployment.

#### Tasks

1. **Documentation**
   - `docs/architecture.md` - System design
   - `docs/phases.md` - Feature rollout
   - `docs/safety.md` - Safety constraints
   - `README.md` - Getting started

2. **Deployment**
   - Vercel project setup
   - Environment variables
   - Cron job configuration
   - Production checklist

3. **Testing**
   - Unit tests for core logic
   - Integration tests for adapters
   - E2E tests for bot execution

**Deliverables:**

- Complete documentation
- Production deployment guide
- Test coverage

---

## Configuration Files Needed

### `config/strategy.yaml`

```yaml
monthlyInvestmentUsd: 175

allocation:
  BTC: 0.45
  ETH: 0.30
  USDT: 0.15
  SOL: 0.05
  BNB: 0.05

earnRules:
  BTC:
    flex: 1.0

  ETH:
    staking: 0.5
    locked: 0.3
    flex: 0.2

  SOL:
    staking: 0.6
    locked: 0.2
    flex: 0.2

  BNB:
    locked: 0.5
    flex: 0.3

  USDT:
    locked: 0.6
    flex: 0.4

safety:
  maxLockedPercentage: 0.8
  minFlexPercentage: 0.2
  allowSell: false  # Set to true only during rebalancing
  allowFutures: false
  allowMargin: false
  allowStructuredProducts: false

schedule:
  type: cron
  expression: "0 9 3 * *"  # 9 AM on the 3rd of each month

# Yearly Rebalancing (Compulsory)
rebalance:
  enabled: true
  month: 1  # January
  tolerancePercent: 5  # +/- 5% drift triggers rebalance
  dayOfMonth: 15  # Run on January 15th
```

### `config/features.yaml`

```yaml
exchange:
  binance: true

storage:
  enabled: true
  provider: supabase

alerts:
  enabled: true
  telegram: true

ai:
  enabled: false
  provider: adk-ts

ui:
  enabled: true
  strategyEditing: false  # Phase 1: read-only, Phase 2: true

# Strategy Source
# - "file": Strategy from config/strategy.yaml (default)
# - "database": Strategy from Supabase (only when ui.strategyEditing=true)
strategySource: file
```

---

## Environment Variables

```env
# Binance
BINANCE_API_KEY=
BINANCE_API_SECRET=

# Supabase (optional)
SUPABASE_URL=
SUPABASE_ANON_KEY=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# AI (optional)
GEMINI_API_KEY=

# Auth
AUTH_SECRET=
MAGIC_LINK_SECRET=
```

---

## Success Criteria

- [ ] Bot executes monthly without manual intervention
- [ ] Allocation stays within 5% tolerance of targets
- [ ] Yearly rebalancing runs every January and corrects drift
- [ ] Earn distribution follows configuration
- [ ] All actions are recorded and auditable
- [ ] Dashboard provides clear portfolio visibility
- [ ] System can run unattended for 6+ months
- [ ] Zero incidents of unauthorized or unexpected trades
- [ ] Strategy source logic works correctly (file vs database)

---

## Next Steps

Start with **Phase 1: Foundation** by implementing:

1. Core domain types in `packages/core/types.ts`
2. Adapter interfaces
3. Complete strategy schema and loader

Ready to begin?
