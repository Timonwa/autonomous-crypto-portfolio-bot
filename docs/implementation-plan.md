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

### 📁 Project Structure

```
/apps
  /bot-runner          # Main bot execution
  /dashboard           # Next.js read-only UI

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

## Implementation Phases

### Phase 1: Foundation (Core Types & Interfaces)

**Goal:** Establish domain types and adapter interfaces that all modules depend on.

#### Tasks

1. **Define core domain types** (`packages/core/types.ts`)
   - `AssetBalance` - Current holdings per asset
   - `PortfolioSnapshot` - Point-in-time portfolio state
   - `EarnPosition` - Staking/locked/flex positions
   - `TradeOrder` - Buy order representation
   - `RunResult` - Execution summary
   - `Action` - Recorded action (buy, subscribe, etc.)

2. **Define adapter interfaces**
   - `ExchangeAdapter` (`packages/exchange/adapter.ts`)
     - `getBalances(): Promise<AssetBalance[]>`
     - `getEarnPositions(): Promise<EarnPosition[]>`
     - `executeBuy(order: TradeOrder): Promise<TradeResult>`
     - `subscribeEarn(asset, product, amount): Promise<EarnResult>`
   - `StorageAdapter` (`packages/storage/adapter.ts`)
     - `saveSnapshot(snapshot: PortfolioSnapshot): Promise<void>`
     - `saveRun(run: RunResult): Promise<void>`
     - `saveAction(action: Action): Promise<void>`
   - `AlertAdapter` (`packages/alerts/adapter.ts`)
     - `sendRunStarted(): Promise<void>`
     - `sendRunCompleted(summary: RunResult): Promise<void>`
     - `sendError(error: Error): Promise<void>`
   - `AIAdapter` (`packages/ai/adapter.ts`)
     - `validatePlan(actions: Action[]): Promise<ValidationResult>`
     - `summarizeRun(run: RunResult): Promise<string>`

3. **Complete strategy schema** (`packages/strategy/schema.ts`)
   - Finalize all Zod schemas
   - Add refinements and constraints
   - Export inferred TypeScript types

4. **Implement strategy loader** (`packages/strategy/loader.ts`)
   - Load YAML configuration
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

4. **Guards** (`packages/core/guards.ts`)
   - Validate configuration constraints
   - Check safety rules before execution
   - Fail-fast on violations

5. **Core barrel export** (`packages/core/index.ts`)
   - Export all modules
   - Provide `executePlan()` function

**Deliverables:**

- Complete allocation calculation
- Earn distribution logic
- Reconciliation producing action plans
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
   - Load configuration
   - Initialize adapters
   - Execute reconciliation
   - Run action plan
   - Record results

2. **Lifecycle hooks** (`apps/bot-runner/lifecycle.ts`)
   - `beforeRun()` - Pre-execution checks
   - `afterRun()` - Cleanup and notifications
   - Error handling wrapper

3. **Cron wrapper** (`apps/bot-runner/cron.ts`)
   - Vercel cron-compatible handler
   - Environment-based configuration
   - Idempotency checks

4. **Feature flags integration** (`packages/flags/`)
   - Define all flags (alerts, storage, AI, etc.)
   - Runtime flag resolution
   - Graceful degradation

**Deliverables:**

- Executable bot with `pnpm run bot:run`
- Cron-compatible endpoint
- Feature flag control over optional modules

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

4. **Database schema**
   - Create migrations for tables
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
   - Anomaly detected

**Deliverables:**

- Working Telegram notifications
- Clear, formatted messages
- Optional based on feature flag

---

### Phase 7: Dashboard (Read-Only UI)

**Goal:** Build a Next.js dashboard for observability.

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
   - All routes are **read-only**

4. **UI components**
   - Portfolio overview (pie chart)
   - Historical growth chart
   - Earn distribution breakdown
   - Run history table
   - Action audit log

5. **Pages**
   - `/` - Dashboard home
   - `/history` - Historical views
   - `/runs` - Run details

**Deliverables:**

- Deployed dashboard on Vercel
- Magic link authentication
- Real-time portfolio visibility

---

### Phase 8: AI Integration (Optional)

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

### Phase 9: Scripts & Utilities

**Goal:** Provide developer tooling.

#### Tasks

1. **Dry run script** (`scripts/dry-run.ts`)
   - Execute full flow without trades
   - Print planned actions
   - Validate configuration

2. **Seed script** (`scripts/seed.ts`)
   - Populate test data
   - Create sample snapshots

**Deliverables:**

- `pnpm run dry-run` working
- Development utilities

---

### Phase 10: Documentation & Deployment

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
  allowSell: false
  allowFutures: false
  allowMargin: false
  allowStructuredProducts: false

schedule:
  type: cron
  expression: "0 9 3 * *"
```

### `config/features.yaml`

```yaml
storage:
  enabled: true
  provider: supabase

alerts:
  enabled: true
  provider: telegram

ai:
  enabled: false
  provider: adk-ts
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
- [ ] Earn distribution follows configuration
- [ ] All actions are recorded and auditable
- [ ] Dashboard provides clear portfolio visibility
- [ ] System can run unattended for 6+ months
- [ ] Zero incidents of unauthorized or unexpected trades

---

## Next Steps

Start with **Phase 1: Foundation** by implementing:

1. Core domain types in `packages/core/types.ts`
2. Adapter interfaces
3. Complete strategy schema and loader

Ready to begin?
