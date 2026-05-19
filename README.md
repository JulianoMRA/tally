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
| Database       | SQLite via node-sqlite3-wasm     |
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
- [x] **Slice 6** — Installment expenses (new + in-progress migration + advancing parcelas + cancel pending)
- [x] **Slice 7** — Subscriptions (register, lazy occurrence generation, cancel, monthly value adjustment)
- [x] **Slice 8** — Off-card expenses (debit, Pix, cash) with month-grouped listing
- [x] **Slice 9** — Contributors and shared expenses with "owe me" dashboard, recurring aid replication, net-of-aid statement total
- [ ] **Slice 10** — Income sources (recurring and one-off)
- [ ] **Slice 11** — Monthly consolidated view
- [ ] **Slice 12** — Multi-month navigation and projection
- [ ] **Slice 13** — Reports and visualizations
- [ ] **Slice 14** — Hardening and polish

Each merged slice gets a short progress note in the changelog section below.

### Changelog

**Slice 9** — Contributors and shared expenses (RF-AJU-01..06, RN-05, RN-07). Pure domain service `selecionarParcelasParaReplicarAjuda` filters future parcelas in `Aberta` statements for recurring-aid replication — 8 unit tests cover boundary cases. `ContribuidorRepository` adds standard CRUD (12 tests). `AjudaRepository` adds `criar` with atomic replication (when `recorrente=true` on Parcelada/Assinatura, copies the aid to every future parcela in `Aberta` statements; Fechada/Paga preserved), `listarPorParcela`, `listarPorFatura`, `totaisPorFatura`, `marcarRecebida`, `excluir` and `listarAgrupadoPorContribuidor` for the dashboard (15 tests). `FaturaDetalhada` extended with `totalAjudasCentavos` and `totalLiquidoCentavos`; the IPC handler now joins the aid totals. Six new typed IPC channels (contribuidor CRUD + 5 of ajuda). New route `/contribuidores` (Configuração) mirrors Cartões/Categorias pattern. `FaturaDetalhe` gains an "Ajudas" column per parcela with `AjudaChip` (name+value, click × to delete) and a `+` button that opens `AdicionarAjudaModal` — the "Replicar nas próximas parcelas" checkbox only appears for Parcelada/Assinatura. Footer now shows three lines: Total bruto / Ajudas (− value) / **Líquido** (highlighted). New route `/ajudas` with `AjudasPage` dashboard grouped by contribuidor, toggle Pendentes/Recebidas, "Marcar recebida" modal with date picker, and Excluir action. 263 tests passing, lint and typecheck clean.

**Slice 8** — Off-card expenses (RF-DES-01, RF-VIS-01 partial). `DespesaRepository.criarUnicaForaCartao` persists Pix/Débito/Dinheiro expenses atomically with `cartao_id = NULL` and a single parcela 1/1 with `fatura_id = NULL` — no statement is generated since RN-01 doesn't apply. `listarGastosForaCartao({ mesReferencia })` queries by calendar month via `substr(data_compra, 1, 7)`. Schema CHECK already enforced the invariant; tests verify both forward (Pix without card) and reverse (Credito without card / Pix with card) cases. Two new typed IPC channels + Zod schemas (`despesaUnicaForaCartaoInputSchema`, `listarGastosForaCartaoInputSchema`). The "Única" tab in `DespesaForm` gains a secondary payment-method selector (Crédito / Pix / Débito / Dinheiro); when non-Crédito, the card field is hidden and a separate `FormUnicaForaCartao` subform routes to the new IPC. `CamposComuns` refactored with a `mostrarCartao` flag instead of duplication. New route `/gastos` with `GastosPage` that takes a `<input type="month">` filter, shows colour-chipped lines (Pix green, Débito blue, Dinheiro neutral) and a month total in the footer. New Sidebar item "Gastos" in the Finanças group between Despesas and Assinaturas. 228 tests passing, lint and typecheck clean.

**Slice 7** — Subscriptions (RF-DES-04, RF-DES-07, RF-DES-08, RN-04). Pure domain service `gerarOcorrenciasAssinatura` generates N monthly occurrences from a start date — uses RN-01 for the first reference month and a shared `proxMesReferencia` helper (extracted from `gerar-parcelas.ts`) for the rest. 13 unit tests cover quantity, year boundary, late-cycle starts, and lazy `ocorrenciaInicial` for Slice 12. `DespesaRepository` gains `criarAssinaturaCredito` (12-month horizon, atomic insert of despesa + 12 faturas + 12 parcelas with `total = NULL`), `cancelarAssinatura` (sets `ativa = 0` and deletes parcelas only in `Aberta` statements, preserving `Fechada`/`Paga` history), `reajustarValorMensalAssinatura` (updates value on pending parcelas in open statements only), and `listarAssinaturas` with an optional `ativa` filter. Four new typed IPC channels + Zod schemas. `DespesaForm` gains a fourth tab "Assinatura" with description, category, card, monthly value and start date. New route `/assinaturas` with `AssinaturasPage` lists active/cancelled subscriptions, exposes a "Reajustar" modal and a "Cancelar" button per row. New Sidebar entry between Despesas and Faturas. 218 tests passing, lint and typecheck clean.

**Slice 6** — Installment expenses (RF-DES-02, RF-DES-03, RF-DES-05, RF-DES-06, RN-02, RN-03). Two pure domain services: `gerarParcelas` (generates N installments using RN-01 per slot, distributes remainder centavos to last parcela) and `selecionarParcelasParaAdiantar` (picks N most-future eligible parcelas for a target statement, filters Fechada/Paga, validates destination). 30 unit tests. `DespesaRepository` gains `criarParceladaCredito` and `criarParceladaEmAndamento` (RF-DES-03: only remaining parcelas K/N..N/N created — no retroactive history). `ParcelaRepository` gains `adiantar` (moves parcelas atomically, returns affected statement ids) and `cancelarPendentes` (deletes only Aberta-statement parcelas, preserves Fechada/Paga). `FaturaRepository` gains `upsertParaMesReferencia` (idempotent upsert by pre-computed reference month, bypasses RN-01). 4 new typed IPC channels + Zod schemas. `DespesaForm` split into three sub-forms (Única/Parcelada/Em andamento) with a segmented type selector; "Parcelada" shows live per-installment value. `FaturaDetalhe` gains an "Adiantar parcelas" button (Aberta only) that opens an `AdiantarParcelasModal`. 193 tests passing, lint and typecheck clean.

**Slice 5** — Statement lifecycle (RF-FAT-02, RF-FAT-04, RF-FAT-05, RN-06). Auto-closes overdue statements on next list call (DB write, not derived state). Domain service `ciclo-fatura` with pure transition functions (`fecharFatura`, `pagarFatura`, `reabrirFatura`, `precisaAutoFechar`) — TDD with 16 unit tests. `FaturaRepository` gains `fecharVencidas`, `fechar`, `pagar`, `reabrir` methods. Three new typed IPC channels. `FaturaDetalhe` shows contextual action buttons per status: "Fechar fatura" (Aberta), inline date form + "Confirmar pagamento" (Fechada), "Reabrir fatura" (Paga) — all with confirmation.

**Slice 4.5** — Visual identity and design system. `tokens.css` with Cream/Forest dual-theme palette (Forest ready for Slice 14 switcher). Geist + Geist Mono via `@fontsource` (offline-first). Four logo variants (`primary`, `tally`, `stack`, `monogram`) ported to typed React components. Shared UI primitives: `Button`, `Card`, `Panel`, `Badge`, `Input`, `Select`, `Field`, `EmptyState`. New `Sidebar` (232px, nav groups, footer avatar) and `Topbar` (56px, sticky). All four existing feature screens (Cartões, Categorias, Despesas, Faturas) migrated to the new system.

**Slice 4** — One-shot credit expenses + statement auto-creation (RF-DES-01, RF-FAT-01, RF-FAT-03 partial). `DespesaRepository.criarUnicaCredito` runs an atomic transaction: inserts the expense, upserts the statement via RN-01, inserts parcela 1/1. `FaturaRepository.findById` added. Statement detail page lists parcelas with gross total. Default landing page changed to `/despesas`.

**Slice 3** — Categories CRUD (RF-CAT-01, RF-CAT-02). Full create/edit/archive/unarchive flow with type selector (Despesa/Renda/Ambos), color picker, and optional free-text icon field. IPC contract includes a `tipo` filter used by future slices when populating expense/income forms. Follows the handler + repository + Zod schema template established in Slice 2.

**Slice 2** — Cards CRUD (RF-CAR-01, RF-CAR-02). Full create/edit/archive/unarchive flow with color picker, day validation, and typed IPC. Establishes react-router, React Hook Form + Zod, and the IPC handler template for all subsequent slices. RF-CAR-03 indicators (open statement total, next due date) pending Slice 5.

**Slice 1** — Domain foundation. SQLite migrations, all entities defined, RN-01 (`calcularReferenciaFaturaDaCompra`) implemented with full edge-case coverage (leap year, month-end clamp, exact closing-day boundary).

**Slice 0** — Project scaffolding. Electron + Vite + React + TypeScript strict + node-sqlite3-wasm + Vitest + Playwright + ESLint + Prettier + Husky + commitlint + GitHub Actions CI.

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
