# agent.md

## Project Context

This project is an **automated monthly crypto investment system built around Binance**.

The goal is to **systematically invest a fixed amount of money every month**, buy predefined cryptocurrencies based on fixed percentages, and then allocate each purchased asset into appropriate holding strategies such as:

- flexible yield,
- locked yield,
- or staking.

The system is **long-term, rules-based, and non-speculative**.

It is **not** a trading bot.
It does **not** time the market.
It does **not** optimize for APR.
It does **not** react to price movements.

The same rules are applied consistently every month.

---

## Core Behavior

1. **Monthly execution**
   - Runs once per month on a fixed schedule.
   - Uses a fixed USD amount for investment.
   - No intra-month or real-time execution.

2. **Asset purchasing**
   - Buys a predefined list of cryptocurrencies.
   - Uses fixed allocation percentages.
   - Buy-only strategy (no forced selling).

3. **Post-purchase allocation**
   - Each asset is split into:
     - flexible holdings,
     - locked yield,
     - staking (if supported).
   - Percentages are **fixed by configuration**, not APR-driven.

4. **Yield handling**
   - Yield is a bonus, not the objective.
   - APR fluctuations must not affect allocation logic.
   - Liquidity constraints must always be respected.

5. **State reconciliation**
   - On every run, the system:
     - reads current balances,
     - recomputes targets,
     - acts only on deficits,
     - never breaks existing locks.

---

## Design Principles (Non-Negotiable)

- Automation over manual control
- Deterministic, repeatable behavior
- Safety and liquidity before yield
- Fixed allocation rules
- No hidden logic
- No smart contracts
- No leverage
- No futures, margin, or structured products
- Binance is the reference implementation

---

## Architecture Expectations

The codebase is **modular and composable**.

The system consists of:

- a core bot (required),
- optional alerting,
- optional storage/logging,
- optional AI insights,
- optional web UI.

Each module must:

- be independently removable,
- communicate via interfaces (adapters),
- not assume the presence of other modules.

The bot must function even if:

- alerts are disabled,
- storage is disabled,
- AI is disabled,
- UI is not deployed.

---

## Execution Authority

- The **bot is the only component allowed to make decisions**.
- The UI is **read-only**.
- AI is **advisory only** and must never:
  - select assets,
  - change allocations,
  - execute trades,
  - override rules.

---

## Configuration Model

All strategy decisions are defined via configuration:

- monthly investment amount,
- asset allocation percentages,
- earn distribution percentages,
- staking derivatives mapping (see below),
- safety constraints,
- schedule.

Configuration is treated as **law**.
The system must fail fast if configuration is invalid.

---

## Staking Derivatives Configuration

When assets are staked, exchanges may issue **derivative tokens** to represent the staked position. This system supports **fully configurable** staking derivatives.

### Derivative Types

1. **Liquid Staking Derivatives** (`type: liquid`)
   - Tradable tokens that represent staking exposure
   - Examples: WBETH (staked ETH), BNSOL (staked SOL)
   - Trading these tokens = exiting staking exposure
   - Treat base asset + derivative as the **same exposure**
   - Only trade during yearly rebalancing or strategy changes

2. **Non-Tradable Wrappers** (`type: non_tradable`)
   - Cannot be traded directly
   - Must be redeemed to another asset first
   - Example: RWUSD (redeems to USDC)
   - **Never count** these as portfolio assets
   - **Never attempt** to rebalance these directly

### Configuration Format

```yaml
stakingDerivatives:
  ETH:
    symbol: WBETH           # The derivative token
    type: liquid            # liquid or non_tradable
    description: "Staked ETH"
  
  SOL:
    symbol: BNSOL
    type: liquid
  
  USDT:
    symbol: RWUSD
    type: non_tradable
    redeemsTo: USDC         # Required for non_tradable
```

### Key Rules

- **Dynamic**: No hardcoded asset symbols. Users define their own derivatives.
- **Exposure**: Base asset + liquid derivative = same exposure (never both active)
- **Trading**: Liquid derivatives can only be traded during rebalancing
- **Portfolio**: Non-tradable wrappers are excluded from portfolio calculations
- **Safety**: `allowLiquidStakingTrades: false` prevents accidental exits

---

## Persistence & Observability

When enabled, the system records:

- portfolio snapshots,
- monthly run summaries,
- executed actions,
- failures or anomalies.

Persistence is for **visibility and trust**, not control.

---

## Notifications

When enabled, notifications (e.g. Telegram) are used to:

- confirm a run started,
- confirm a run succeeded,
- report failures clearly.

Notifications must not affect execution.

---

## Hosting & Execution

- The bot is intended to run remotely.
- Typical deployment:
  - Next.js + API routes for execution
  - Scheduled execution via cron (e.g. Vercel cron)
- No always-on worker is required.
- Free-tier friendly.

---

## What NOT to Build

Do NOT add:

- user accounts or roles,
- dashboards that trigger execution,
- real-time trading logic,
- APR optimization logic,
- strategy mutation,
- complex authentication systems,
- SaaS-style features.

---

## Guiding Instruction for Copilot

When generating code for this project:

- prefer clarity over cleverness,
- follow the defined rules strictly,
- do not introduce features that violate constraints,
- ask for configuration rather than inventing logic,
- keep modules loosely coupled,
- assume long-term unattended execution.

If unsure, default to **doing less, not more**.
