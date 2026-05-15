# Tally

> A desktop app for monthly personal finance tracking. Replaces the spreadsheet I duplicated every month with something that does the math itself.

![status](https://img.shields.io/badge/status-in%20development-yellow)
![license](https://img.shields.io/badge/license-MIT-blue)
![tests](https://img.shields.io/badge/tests-coming%20soon-lightgrey)

Tally is a personal project built to replace a Google Sheets workflow that demanded manual work every month: copying the previous month's tab, incrementing parcela numbers (`7/12` → `8/12`), recalculating credit card statement totals, and tracking who owed me what. Tally does all of it automatically.

It's also a portfolio piece for my repositioning to **QA / Test Automation Engineer** — built with test-driven development from the ground up, comprehensive automated test coverage, and a full CI pipeline.

---

## Why

Brazilian personal finance often involves credit card installments (parcelamentos), shared expenses with family (when someone covers part of a subscription or split purchase), and multiple cards with different closing/due dates. The spreadsheets people build around this get repetitive fast:

- Each month is a near-copy of the last, with parcela counters incremented by hand
- Future projection is impossible without manually building each upcoming month
- Tracking who owes you what for shared expenses lives outside the spreadsheet, in memory or text messages
- Adding categorization or running "how much did I spend on subscriptions last quarter" requires rebuilding the structure every time

Tally solves these with first-class support for installment plans, recurring subscriptions, shared expenses (called "ajudas" in the domain), per-card statement cycles, and multi-month projection.

---

## Tech stack

| Layer          | Technology                       |
| -------------- | -------------------------------- |
| Runtime        | Node.js 20 LTS                   |
| Desktop shell  | Electron 30+                     |
| Bundler        | Vite 5+                          |
| UI             | React 18 + TypeScript 5 (strict) |
| Database       | SQLite via better-sqlite3        |
| Unit testing   | Vitest                           |
| E2E testing    | Playwright                       |
| Lint / Format  | ESLint + Prettier                |
| Commit hygiene | commitlint + Husky + lint-staged |
| CI             | GitHub Actions                   |

Architecture follows clean separation across four layers: **domain** (pure business rules, zero external dependencies), **persistence** (SQLite repositories), **main process** (Electron lifecycle and IPC), and **renderer** (React UI). See [`CLAUDE.md`](./CLAUDE.md) for full conventions.

---

## Quality engineering

Quality strategy is treated as a first-class concern, not an afterthought.

- **TDD mandatory in the domain layer.** All business rules (RN-01 through RN-08 documented in [`PRD.md`](./PRD.md)) start with a failing test before any implementation.
- **Coverage minimums:** 80% in the domain layer, 60% global.
- **Integration tests** run against in-memory SQLite to validate repositories without mocking the database.
- **E2E tests** cover the critical user flows: registering an in-progress installment plan, advancing parcelas, marking a contribution as received, navigating to a projected future month.
- **CI pipeline** runs lint, typecheck, tests with coverage, and build on every pull request. Branch protection requires a green pipeline before merge.
- **Conventional Commits** enforced via commitlint, enabling automated changelog generation.

Bug reports during development follow a structured template (preconditions, steps, expected vs actual, severity, evidence) and live as GitHub Issues.

---

## Status

This project is in active development. The implementation is being delivered in vertical slices — each one a thin end-to-end feature with UI, logic, persistence, and tests.

### Roadmap

- [x] **Slice 0** — Project setup (Electron + Vite + React + TS + SQLite + test runners + CI)
- [x] **Slice 1** — Domain foundation: migrations, base entities, statement-from-purchase-date rule
- [x] **Slice 2** — Cards CRUD with closing and due dates
- [x] **Slice 3** — Categories CRUD
- [x] **Slice 4** — One-shot expenses + statement creation
- [x] **Slice 4.5** — Visual identity: design system (tokens, Geist font, logo, UI primitives), full app restyle
- [x] **Slice 5** — Statement lifecycle (Open → Closed → Paid)
- [ ] **Slice 6** — Installment expenses (new + in-progress migration + advancing parcelas)
- [ ] **Slice 7** — Subscriptions with lazy occurrence generation
- [ ] **Slice 8** — Off-card expenses (debit, Pix, cash)
- [ ] **Slice 9** — Contributors and shared expenses with "owe me" dashboard
- [ ] **Slice 10** — Income sources (recurring and one-off)
- [ ] **Slice 11** — Monthly consolidated view
- [ ] **Slice 12** — Multi-month navigation and projection
- [ ] **Slice 13** — Reports and visualizations
- [ ] **Slice 14** — Hardening and polish

Each merged slice gets a short progress note in the changelog section below.

### Changelog

**Slice 5** — Statement lifecycle (RF-FAT-02, RF-FAT-04, RF-FAT-05, RN-06). Auto-closes overdue statements on next list call (DB write, not derived state). Domain service `ciclo-fatura` with pure transition functions (`fecharFatura`, `pagarFatura`, `reabrirFatura`, `precisaAutoFechar`) — TDD with 16 unit tests. `FaturaRepository` gains `fecharVencidas`, `fechar`, `pagar`, `reabrir` methods. Three new typed IPC channels. `FaturaDetalhe` shows contextual action buttons per status: "Fechar fatura" (Aberta), inline date form + "Confirmar pagamento" (Fechada), "Reabrir fatura" (Paga) — all with confirmation.

**Slice 4.5** — Visual identity and design system. `tokens.css` with Cream/Forest dual-theme palette (Forest ready for Slice 14 switcher). Geist + Geist Mono via `@fontsource` (offline-first). Four logo variants (`primary`, `tally`, `stack`, `monogram`) ported to typed React components. Shared UI primitives: `Button`, `Card`, `Panel`, `Badge`, `Input`, `Select`, `Field`, `EmptyState`. New `Sidebar` (232px, nav groups, footer avatar) and `Topbar` (56px, sticky). All four existing feature screens (Cartões, Categorias, Despesas, Faturas) migrated to the new system.

**Slice 4** — One-shot credit expenses + statement auto-creation (RF-DES-01, RF-FAT-01, RF-FAT-03 partial). `DespesaRepository.criarUnicaCredito` runs an atomic transaction: inserts the expense, upserts the statement via RN-01, inserts parcela 1/1. `FaturaRepository.findById` added. Statement detail page lists parcelas with gross total. Default landing page changed to `/despesas`.

**Slice 3** — Categories CRUD (RF-CAT-01, RF-CAT-02). Full create/edit/archive/unarchive flow with type selector (Despesa/Renda/Ambos), color picker, and optional free-text icon field. IPC contract includes a `tipo` filter used by future slices when populating expense/income forms. Follows the handler + repository + Zod schema template established in Slice 2.

**Slice 2** — Cards CRUD (RF-CAR-01, RF-CAR-02). Full create/edit/archive/unarchive flow with color picker, day validation, and typed IPC. Establishes react-router, React Hook Form + Zod, and the IPC handler template for all subsequent slices. RF-CAR-03 indicators (open statement total, next due date) pending Slice 5.

**Slice 1** — Domain foundation. SQLite migrations, all entities defined, RN-01 (`calcularReferenciaFaturaDaCompra`) implemented with full edge-case coverage (leap year, month-end clamp, exact closing-day boundary).

**Slice 0** — Project scaffolding. Electron + Vite + React + TypeScript strict + better-sqlite3 + Vitest + Playwright + ESLint + Prettier + Husky + commitlint + GitHub Actions CI.

---

## Getting started

> **Prerequisites:** Node.js 20 LTS and npm.

```bash
git clone https://github.com/JulianoMRA/tally.git
cd tally
npm install
npm run dev
```

> _Commands will be defined in `package.json` after Slice 0. Expected scripts include `dev`, `build`, `test`, `test:coverage`, `e2e`, `lint`, `typecheck`._

---

## Project documentation

| Document                                               | Purpose                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| [`PRD.md`](./PRD.md)                                   | Product requirements, business rules (RN-01..RN-08), data model, full roadmap |
| [`CLAUDE.md`](./CLAUDE.md)                             | Operational guide: stack, architecture, conventions, glossary                 |
| [`CLAUDE_CODE_STRATEGY.md`](./CLAUDE_CODE_STRATEGY.md) | Per-slice strategy for AI-assisted development (model and effort selection)   |

---

## About the author

Built by [Juliano Melo Rodrigues Alencar](https://github.com/JulianoMRA), Computer Science student at UFC (Universidade Federal do Ceará). Currently pursuing a QA / Test Automation Engineering internship in Brazil.

---

## License

[MIT](./LICENSE)
