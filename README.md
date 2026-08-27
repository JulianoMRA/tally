# Tally

> A desktop app for monthly personal finance tracking. Replaces the spreadsheet I duplicated every month with something that does the math itself.

![status](https://img.shields.io/badge/status-released%20%C2%B7%20in%20daily%20use-green)
![license](https://img.shields.io/badge/license-MIT-blue)

Tally is a personal project built to replace a Google Sheets workflow that demanded manual work every month: copying the previous month's tab, incrementing parcela numbers (`7/12` → `8/12`), and recalculating credit card statement totals. Tally does all of it automatically.

It's also a portfolio piece for my repositioning to **QA / Test Automation Engineer** — built with test-driven development from the ground up and comprehensive automated test coverage across unit, integration, E2E, accessibility and mutation testing.

---

## Why

Brazilian personal finance often involves credit card installments (parcelamentos), monthly subscriptions, and multiple cards with different closing/due dates. The spreadsheets people build around this get repetitive fast:

- Each month is a near-copy of the last, with parcela counters incremented by hand
- Future projection is impossible without manually building each upcoming month
- Categorization and "how much did I spend on subscriptions last quarter" require rebuilding the structure every time
- Off-card spending (Pix, debit, cash) lives in a different sheet — never consolidated with credit-card totals

Tally solves these with first-class support for installment plans, recurring subscriptions, per-card statement cycles, off-card spending, recurring/one-off income tracking, and multi-month projection.

---

## Tech stack

| Layer            | Technology                       |
| ---------------- | -------------------------------- |
| Runtime          | Node.js 20 LTS                   |
| Desktop shell    | Electron 30+                     |
| Bundler          | Vite 5+                          |
| UI               | React 18 + TypeScript 5 (strict) |
| Database         | SQLite via node-sqlite3-wasm     |
| Unit testing     | Vitest                           |
| E2E testing      | Playwright                       |
| Lint / Format    | ESLint + Prettier                |
| Commit hygiene   | commitlint + Husky + lint-staged |
| Mutation testing | Stryker                          |

Architecture follows clean separation across four layers: **domain** (pure business rules, zero external dependencies), **persistence** (SQLite repositories), **main process** (Electron lifecycle and IPC), and **renderer** (React UI). See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup and conventions.

---

## Quality engineering

Quality strategy is treated as a first-class concern, not an afterthought.

- **TDD mandatory in the domain layer.** All business rules (RN-01 through RN-08 documented in [`PRD.md`](./PRD.md)) start with a failing test before any implementation.
- **Coverage minimums:** 80% in the domain layer, 60% global.
- **Integration tests** run against in-memory SQLite to validate repositories without mocking the database.
- **E2E tests** (84 Playwright specs against the real Electron app, each in an isolated temp database) cover the critical user flows: registering an in-progress installment plan, advancing parcelas, paying a statement — which locks its expenses against edit/deletion (RN-06) —, deleting expenses, navigating to a projected future month, per-category budgets, and reports. Beyond flows, they also assert things a click-through never catches: that no screen scrolls horizontally at three window widths, that row actions aren't clipped by their container, and that every page opens at the same left edge regardless of its width tier.
- **Accessibility scans** (axe-core via Playwright) run against every main screen — serious/critical WCAG violations fail the suite.
- **Mutation testing** (Stryker) runs against the domain layer, measuring whether the tests actually detect behavioral changes — not just line coverage. Current score: **93%** (650 mutants, 4 of 14 services at 100%).
- **The whole pipeline runs locally** through npm scripts (`lint`, `typecheck`, `test:coverage`, `e2e`, `test:mutation`, `build`), run before opening a PR. Git hooks enforce the fast half automatically: pre-commit runs ESLint and Prettier on staged files, commit-msg validates Conventional Commits, and pre-push runs typecheck plus the full unit suite.
- **Conventional Commits** enforced via commitlint, enabling automated changelog generation.

Bug reports during development follow a structured template (preconditions, steps, expected vs actual, severity, evidence) and live as GitHub Issues.

---

## Status

Tally has been in daily real use since **v1.0.0** and is currently at **v1.10.0**. The MVP and the whole V2 scope in [`PRD.md`](./PRD.md) are delivered; development continues in releases. The implementation was built in vertical slices — each one a thin end-to-end feature with UI, logic, persistence, and tests.

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
- [x] **Slice 10** — Income sources (recurring and one-off) with monthly receipt tracking, default-value adjustment, one-shot entries
- [x] **Slice 11** — Monthly consolidated view with cards, net balance (realized + projected), per-month navigation
- [x] **Slice 12** — Multi-month navigation and projection (lazy horizon extension up to 24 months ahead)
- [x] **Slice 12.1** — Cleanup and simplification: visual bug fixes, RF-DES-09 (expense deletion), Slice 9 rollback (Contributors + Aids removed), category icon and renda category removed
- [x] **Slice 12.2** — Rendas and Recebimentos screens unified under `/rendas` with segmented tabs (Recebimentos do mês / Fontes de renda)
- [x] **Slice 13** — Reports and visualizations (recharts: balance evolution + monthly category pie/ranking + per-category temporal line)
- [x] **Slice 14** — Hardening and polish (electron-builder NSIS + portable, coverage RNF-06, Toast/ConfirmDialog/useEscapeKey)
- [x] **Slice 14.1** — Post-MVP polish from real-use feedback: visual fixes, expense editing (RF-DES-10), income editing (RF-REN-06), per-row "Adiantar", column sorting, expense descriptions in invoice detail, Rendas grouped by type
- [x] **Slice 15** — Hardening, QA e cleanup pós-MVP: isolação E2E (TALLY_USER_DATA), hardening Electron + CSP, row-mappers consolidados, migrations 0003 (drop colunas mortas) + 0004 (normaliza `data_referencia`), Zod em todos os canais IPC, `noImplicitAny`, CI matriz Windows+Ubuntu com coverage gating, pre-push hook
- [x] **Bloco D — Orçamento por categoria** — limite mensal por categoria com status visual (ok/alerta/estourado, alerta >= 80%) integrado aos Relatórios; domínio puro em TDD, migration 0005 (índices parciais para o limite global), repositório, IPC tipado e cobertura no export/import
- [x] **Slice 19 — Reativação dos E2E** — os 6 specs Playwright pulados (`gastos`, `rendas`, `relatorios`, `assinaturas`, `excluir-despesa`, `visao-mensal`) realinhados à UI atual + novo spec de orçamento. 12 specs E2E verdes, zero skips
- [x] **Hardening pós-auditoria (jun/2026)** — auditoria completa do app fechada em 6 PRs: pagar fatura sincroniza parcelas para Paga (RN-06 passa a valer de fato, com migration de backfill e proteção de fatura Fechada contra edição/exclusão); datas "hoje" no fuso local em vez de UTC; feedback de erro em todas as telas (helper `mensagem-erro` + toasts); exclusão de recebimento avulso limpa a renda órfã; import valida cada tabela com Zod; E2E em paralelo (lock por `userData` isolado) + typecheck dos specs; CI matriz ubuntu + windows com E2E no Windows

From here the project stopped delivering in slices and started delivering in releases:

- [x] **v1.0.0** (jun/2026) — version cut after the post-audit hardening above. Built locally with electron-builder; never published to GitHub Releases, since the release automation only arrived during v1.1.0
- [x] **v1.1.0** (jul/2026) — the 11-phase post-audit improvement plan, which **closes the entire V2 scope** in [`PRD.md`](./PRD.md): per-category budgets with monthly overrides, CSV/PDF export, configurable automatic backups, and free-form tags/notes. Plus auto-update via GitHub Releases, a CSV importer for migrating off the spreadsheet, OS notifications for statement closing/due dates, and a Settings screen
- [x] **v1.1.1** (jul/2026) — fix release: the Saídas row actions were unreachable, not merely hidden, when the table outgrew its panel
- [x] **Post-1.1.1 (ago/2026)** — repository cleanup: color tokens for status surfaces, removal of the dark theme that never shipped a switcher, design reference material moved under `docs/`, and removal of the hosted CI (the pipeline now runs locally — see [`CONTRIBUTING.md`](./CONTRIBUTING.md))
- [x] **v1.2.0** (ago/2026) — the 8-phase UI/UX plan derived from a full interface audit (the app run against an isolated database, 8 screens captured in 3 states and 3 widths). Ships statement totals in the invoice list, income-source reuse for one-off entries, a first-run onboarding panel, and backup restore from the UI. Row actions collapsed from 5 buttons into a menu; modals gained focus traps; table sorting became keyboard-reachable. The accessibility scan had been running against an **empty** database — with data on screen it immediately found two serious WCAG violations. Coverage went from 706 to 771 unit tests and from 42 to 78 E2E specs
- [x] **v1.2.1** (ago/2026) — fix release: every screen opened at a different left edge, because the page container derived _where a page starts_ from the same `max-width` that capped _how wide it gets_. Also closes a race in the E2E suite where a locator could resolve against the previous route, still mounted mid-navigation
- [x] **v1.6.0** (ago/2026) — a month stepper on Rendas: the previous/next arrows moved out of Visão mensal and Saídas into a shared `SeletorMes`, now used by all three screens. Unifying the three copies also settled two divergences they had been hiding — the guard against an emptied field, and the field width
- [x] **v1.6.1** (ago/2026) — fix release: clicking outside the note-and-tags modal discarded the typed text, in the one modal of six that closed on overlay click and the only one carrying free text. The scaffolding those six had been copying became a shared `Modal` primitive, which settled three more divergences — the accessible name, the dialog width, and overflow on a narrow window
- [x] **v1.6.2** (ago/2026) — fix release from a consistency sweep: three screens showed the raw Electron-wrapped IPC text instead of the actual error message, and a screen could hang on "Carregando…" forever because an auxiliary load had no `.catch`. Seven such unguarded loads were found; the duplicated table CSS became a shared `Table` primitive
- [x] **v1.7.0** (ago/2026) — a custom title bar: the window had two rows of system chrome above the content, and since the sidebar already carries the brand, the app name showed up twice. The old "File" menu moved into the app — including the full JSON export/import, which lived nowhere else. Window controls stay native via `titleBarOverlay` on Windows; Linux keeps the default frame
- [x] **v1.8.0** (ago/2026) — the title bar absorbs the page header: two stacked strips (40px bar + 56px `Topbar` carrying the `h1`) became a single 32px bar, giving ~56px of height back to every screen. The app menu now opens from the brand itself, the screen name moved into the bar and is still the `h1`, and the window controls became the app’s own — Linux keeps the native frame
- [x] **v1.9.0** (ago/2026) — dark theme (“Papel noturno”), toggled from the app menu and remembered across restarts. Picked from three measured palettes; the one that keeps the warmth of the cream theme at the other end of the scale. Getting there meant splitting `--forest`, a token that silently did three jobs because it shared a hex with `--ink`. Along the way: the “Paga” badge failed WCAG AA and the axe sweep had never seen it, the monthly PDF would have printed white-on-white, and a spec had been red since v1.8.0
- [x] **v1.10.0** (ago/2026) — a one-off income entry no longer requires registering an income source. The cause was never the form: `recebimento` had no name column, so the description came from a `LEFT JOIN` on `renda` and creating a source was the only way for the entry to have something to be called. Migration `0011` gives it its own `descricao`, with a `CHECK` making the two states mutually exclusive. Shipped alongside CSV formula-injection neutralisation on month export, and the removal of dead code left behind by earlier refactors

Detalhes técnicos de cada slice em [`CHANGELOG.md`](./CHANGELOG.md).

### Changelog histórico (extraído)

> **Nota:** A partir do Slice 15 o changelog completo vive em
> [`CHANGELOG.md`](./CHANGELOG.md). Entradas abaixo ficam aqui apenas como
> registro do que vivia inline no README durante o MVP.

**Slice 14.1** — Post-MVP polish driven by real-use feedback (the user spent two weeks with the `.exe` populated with real finances and reported 7 friction points in a PDF). Three buckets, all on top of the existing schema (no migrations): (a) **Visual fixes**: VisaoMensal table columns aligned (Recebimentos reordered to Fonte/Esperada/Status/Valor with fixed `.colValor` width matching Faturas' Total); `.formaBtnActive` (Crédito/Pix/Débito/Dinheiro segmented in Despesas) gets the same high-contrast treatment as `.tipoBtnActive` from 12.1 (ink background + bg-elev text); Assinaturas list `<li>` now uses `grid-template-columns: 14px 1fr 140px 90px auto` for vertical alignment regardless of name length. (b) **UX**: "Valor restante" label in Em andamento renamed to **"Valor da parcela"** (more intuitive — backend still receives `valorRestanteCentavos = valorParcela × parcelasRestantes`); **Rendas** "Fontes" tab now shows two separate Panels (Recorrentes sorted by `diaEsperado`, Avulsas alphabetical) with totals; **FaturaDetalhe** parcelas table replaces internal `#` column with **expense description** (fetched via single `SELECT * FROM despesa WHERE id IN (...)` per detail request), supports click-to-sort on every column (Descrição/Parcela/Data/Valor/Status with asc/desc indicator); **Adiantar parcelas** moved from top button to per-row action with redesigned modal (despesaId pre-filled, dropdown of available open invoices on same card). (c) **RF-DES-10 / RF-REN-06 (edit features)**: new pure domain `podeEditarDespesa` + `recalcularParcelasPendentes` (TDD, 16 tests including last-cent distribution and Paid preservation); `DespesaRepository.atualizar` updates description/category/value always, date only for Unica (re-routes to new invoice via RN-01), Parcelada redistributes new value among pending installments via `recalcularParcelasPendentes`; new IPC `despesa:atualizar` with Zod validation; new `EditarDespesaModal` accessible per parcela row (disabled for paid). `RendaRepository.update` now accepts `diaEsperado` for Recorrente and recalculates `data_esperada` of Esperado receipts with `clampDiaNoMes` (e.g., dia 31 in April → 30). New `EditarRendaModal` for both Recorrente and Avulsa. `FaturaDetalhada` extended with `despesasPorParcela: Record<number, Despesa>` so both display (description) and edit (full snapshot) work with a single round-trip. **357 tests passing** (+21 from 336), lint, typecheck and build clean.

**Slice 14** — Hardening + packager (release engineering). Three blocks: (a) **`electron-builder` 26.8.1** added as devDep, `productName: "Tally"` set in package.json, full `build` section with NSIS installer + portable target for Windows x64, `appId: br.com.juliano.tally`, asar enabled, output in `release/`. New scripts `gen:icon`, `dist`, `dist:dir`. Multi-resolution `build/icon.ico` (16/32/48/64/128/256 px) generated by `scripts/gen-icon.mjs` from the primary T-glyph SVG via `sharp` + `png-to-ico` (idempotent, regenerate when the brand changes). First build produces `Tally Setup 0.1.0.exe` (103 MB NSIS) and `Tally-0.1.0-portable.exe` (102 MB) — both use the same `%APPDATA%\tally\tally.db` as dev (case-insensitive on Windows), so real data carries over. (b) **RNF-06 coverage** enforced via `vitest.config.ts` per-glob thresholds: 80% on `src/domain/**`, 60% global — already passing (domain services 100% lines, persistence repositories ~96% lines). (c) **UX polish**: new `Toast` primitive (success/error/info, 3s auto-dismiss, slide-in animation), `ConfirmDialog` primitive (replaces `window.confirm`, supports `danger` variant), `useEscapeKey` hook (Esc closes any modal). `ToastProvider` wraps `<App />`. `FaturaDetalhe` and `AssinaturasPage` migrated: 5 `window.confirm` and 2 `window.alert` calls replaced with `ConfirmDialog` + `toast.show(..., 'error')`. All 4 existing modals (`MarcarRecebidoModal`, `NovoAvulsoModal`, `AdiantarParcelasModal`, `ReajustarValorModal`) plus `ConfirmDialog` itself now close on Esc. **336 tests passing**, lint, typecheck and build clean.

**Slice 13** — Reports and visualizations (RF-VIS-05, RF-VIS-06). New `/relatorios` route in the Finanças sidebar group with three Panels: **"Evolução do saldo"** (recharts LineChart of entradas/saídas/saldo over 6 or 12 months, period toggle), **"Gastos do mês por categoria"** (PieChart + ranking with % share, month picker, combines parcelas from faturas + gastos fora cartão via SQL `UNION ALL` aggregated by `categoria_id`), and **"Evolução por categoria"** (LineChart of monthly spending for a single category, select populated by `categoria.list({ tipo: 'Despesa' })`). Pure domain helpers `agregarPorCategoria` (sums by `categoriaId`, ordered desc) and `gerarSerieMensal` (N retrocedendo) with 8 TDD tests. New `RelatorioRepository` orchestrates 3 aggregations: `totaisPorCategoriaEmMes`, `evolucaoSaldoMensal` (reuses `VisaoMensalRepository.detalhar` per month), `evolucaoCategoriaMensal` — 8 integration tests including zero-fill for empty months. New IPC namespace `relatorio:*` with Zod-validated schemas. Charts use `var(--income)`, `var(--expense)`, `var(--ink)` for evolution and `categoria.cor` directly for pie slices. Helpers `formatBRL`/`formatBRLCompacto` and `formatarMesCurto` extracted to `src/renderer/lib/`. `recharts ^3.8.1` added (~93kb gz tree-shaken). **336 tests passing**, lint, typecheck and build clean.

**Slice 12.2** — Rendas and Recebimentos unified. Previously two separate routes (`/rendas` catalog of sources + `/recebimentos` monthly occurrences) — split that didn't match how the user thinks ("my bolsa comes in in June"). Now a single `/rendas` page with a SegmentedControl alternating between two tabs: **"Recebimentos do mês"** (default — month picker, status filter Todos/Esperado/Recebido, list with "Marcar recebido"/"Excluir", three totalizer cards) and **"Fontes de renda"** (form for Recorrente/Avulsa, list with archive/unarchive, "Mostrar arquivadas" toggle). Refactor 100% UI-side: domain, persistence, IPC contracts untouched. `MarcarRecebidoModal`, `NovoAvulsoModal` and `use-recebimentos.ts` moved (via `git mv`, history preserved) from `features/recebimentos/` to `features/rendas/`. `recebimentos.module.css` merged into `rendas.module.css` (no class collisions thanks to CSS Modules scoping). `/recebimentos` URL now redirects to `/rendas` for compatibility. Sidebar collapses from 2 items to 1. E2E `rendas.spec.ts` adjusted: same flow but tab-switching inside one page instead of cross-page navigation. **320 tests passing** (unchanged — no domain/persistence touched), lint, typecheck and build clean.

**Slice 12.1** — Cleanup and simplification. Three buckets, one PR: (a) visual bugs from manual testing (pluralization "0 cartãoões" → "0 cartões" via new `pluralizar` helper that handles the `ão → ões` substitution; `/mensal` header re-aligned to `align-items: flex-end` with `.mesLabel` getting explicit `height: 32px`; segmented control tabs in Despesas and Rendas now use `var(--ink)` on active background with white text for high contrast); (b) **RF-DES-09 (expense deletion)** with pure domain `podeDeletarDespesa` (5 unit tests covering empty, all-pending, single-paid, mixed, multi-paid), `DespesaRepository.excluir` that runs `DELETE FROM parcela WHERE despesa_id = ?` then `DELETE FROM despesa WHERE id = ?` in a single transaction (respects the `ON DELETE RESTRICT` FK), blocks with descriptive error when there's any paid parcela (5 integration tests), new `despesa:excluir` IPC channel with Zod schema, "Excluir" buttons in `AssinaturasPage` (next to existing Reajustar/Cancelar) and `FaturaDetalhe` (per-row, disabled with tooltip when parcela is Paid), confirmation via native `window.confirm` describing the cascade; (c) **Slice 9 rollback** — removed all Ajudas + Contribuidores code (~20 files: 2 domain entities, 1 domain service + tests, 2 persistence repos + tests, 2 IPC shared modules, 2 main handlers, 2 renderer feature folders + 2 fatura components, 1 E2E spec; routes `/ajudas` `/contribuidores` removed from `router.tsx` and Sidebar), `categoria.icone` and `renda.categoria_id` columns dropped via new migration `0002_simplificacao_pre_slice_13.sql` using recreate-table pattern with `PRAGMA defer_foreign_keys = ON` to safely reorder schema inside the migration transaction, `BalancoMensal.totalSaidasLiquidasCentavos` renamed to `totalSaidasCentavos` (no more "líquido" since there are no aids to subtract), `FaturaResumida.totalBrutoCentavos/totalAjudasCentavos/totalLiquidoCentavos` collapsed to a single `totalCentavos` field. PRD updated with strikethrough on RF-AJU-01..06 and RN-05; RN-07/RN-08 rewritten without aid math. **320 tests passing** (was 352 → −42 deleted aid/contributor tests + 10 new RF-DES-09 tests), lint and typecheck clean.

**Slice 12** — Multi-month navigation and projection (RF-VIS-03, RF-VIS-04, RN-04). New pure domain function `calcularExtensaoNecessaria` decides how many monthly occurrences to generate to reach a target month (idempotent, forward-only, throws if `ultimoMesExistente` is set but `ultimoNumeroExistente` is null) — 7 unit tests. New `diferencaEmMeses(a, b)` helper in `mes-referencia.ts` for the 24-month projection cap. `DespesaRepository.estenderHorizonteAssinaturas(mesAlvo)` walks all `ativa = 1` subscriptions, queries `MAX(p.numero)` + `MAX(f.mes_referencia)` per despesa via subquery, reuses `gerarOcorrenciasAssinatura` with the reserved `ocorrenciaInicial` parameter, and inserts the missing parcelas inside a single transaction — counts new faturas via `findByCartaoEMesReferencia` to avoid double-counting when two subscriptions share a card. 6 integration tests cover the cap, idempotency, non-retroactivity, cancelled subscriptions, multi-card setups. `RendaRepository.estenderHorizonteRecorrentes(mesAlvo)` mirrors the pattern for `tipo = 'Recorrente' AND ativa = 1` rendas: queries `MAX(substr(data_esperada, 1, 7))` + `COUNT(*)`, reuses `gerarRecebimentosRecorrentes`, inserts with status `Esperado`. 6 integration tests including day-of-month clamping in short/leap months (Feb 28/29, Sept 30, Nov 30). `VisaoMensalRepository.detalhar` now calls a new private `estenderHorizonteSeNecessario(mesAlvo)` at the start — computes `mesesAdiante = diferencaEmMeses(hoje, mesAlvo)`, no-op when ≤ 0, no-op when > 24 (cap defensivo), otherwise calls both extension methods. 4 new integration tests use `vi.useFakeTimers` to lock "hoje" deterministically and validate cap behavior. `VisaoMensalPage` gains a `Projeção` badge in the header (new `projection` variant added to the `Badge` primitive with purple-tinted styling matching Slice 11's `closed` palette) shown when the selected month is in the future, plus a secondary `> N meses adiante` chip when `mesesAdiante > 12`. New E2E spec walks the full flow: pre-cadastrar assinatura + renda recorrente → navigate to mês 15 ahead → assert badge visible + Inter fatura + R$ 30 + R$ 800 in the cards. 352 tests passing (was 314 → +38), lint and typecheck clean.

**Slice 11** — Monthly consolidated view (RF-VIS-01/02, RN-07/08). Pure domain `calcularBalancoMensal` implements RN-08: `saldo = recebimentos − (faturas líquido + gastos fora cartão)`, with both Realized (only `Recebido`) and Projected (`Recebido + Esperado`) variants — 5 unit tests. Aid receipts excluded from receipts per RF-AJU-06. New `mesReferenciaAnterior` helper (mirror of `proxMesReferencia`). New `VisaoMensalRepository.detalhar(mes)` aggregates all month data: faturas with bruto/ajudas/líquido per card, gastos fora cartão (Slice 8), recebimentos (Slice 10), and aid pending grouped by contributor (via SQL JOIN). 6 integration tests cover the full pipeline including RN-07 and Recebida exclusion from pending aid. One new IPC channel `visao-mensal:detalhar`. New route `/mensal` is now the **default landing page** — replaces `/despesas` in the index redirect. `VisaoMensalPage` shows four summary cards (Entradas / Faturas líquido / Gastos fora cartão / A receber em ajudas), a large highlighted balance card (Projected as the headline number, Realized as subtext), and three expanded `Panel`s with detailed tables. Header has `←`/`→` arrows + `<input type="month">` + localized month label via `Intl.DateTimeFormat('pt-BR')`. Sidebar gains "Visão mensal" at the top of Finanças. 314 tests passing, lint and typecheck clean.

**Slice 10** — Income sources and receipts (RF-REN-01..05). Pure domain service `gerarRecebimentosRecorrentes` generates N monthly receipt dates from a start date and an expected day-of-month — clamps to last day of short months (Feb 28/29, Apr 30, etc.) via a new `clampDiaNoMes` helper extracted to `mes-referencia.ts`. 13 unit tests cover quantity, day clamping (incl. leap year), year boundary, late-start cycles, and validations. `RendaRepository` adds `criarAvulsa`, `criarRecorrente` (atomic insert of renda + 12 `recebimento` rows with status `Esperado`), `update` (RF-REN-05: when value changes on a Recurring source, propagates to all future `Esperado` receipts only — `Recebido` preserved), `arquivar` (deletes future `Esperado`, preserves `Recebido` history) and `desarquivar`. `RecebimentoRepository` adds `criar`, `criarAvulsoCompleto` (transactionally creates an Avulsa `renda` + receipt for one-shot income with optional `dataRecebida` so users can register past entries), `listar` with month and status filters (LEFT JOIN to surface `rendaNome`), `marcarRecebido`, `excluir`, `totaisPorMes`. 27 integration tests. Two new IPC namespaces (`api.renda` and `api.recebimento`) with 11 typed channels. New route `/rendas` with `RendaForm` (segmented Recorrente/Avulsa, category from `Renda`+`Ambos`) and `RendaList` with Arquivar/Desarquivar. New route `/recebimentos` with month picker, status toggle (Todos/Esperado/Recebido), per-row "Marcar recebido" with date picker modal, "Novo avulso" modal (with "Já recebi" checkbox), and three total cards in the footer (Esperado / Recebido / Total). Sidebar gains "Rendas" and "Recebimentos" in the Finanças group between Assinaturas and Ajudas. 303 tests passing, lint and typecheck clean.

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

## Installation

Grab the latest binaries from [GitHub Releases](https://github.com/JulianoMRA/tally/releases) (built locally with `npm run dist` and uploaded to the release):

- **`Tally-Setup-<version>.exe`** — NSIS installer. Creates desktop + Start Menu shortcuts, lets you pick the install dir, supports clean uninstall. **Auto-updates**: the app checks GitHub Releases on startup (and via the `Arquivo > Verificar atualizações` menu) and applies new versions on quit.
- **`Tally-<version>-portable.exe`** — single-file executable. Just double-click — no install. Good for USB drives or restricted machines. Does **not** auto-update — download new versions manually.

On first launch Windows SmartScreen may warn that the publisher is unverified (the binary is unsigned — this is a personal project, not a commercial app). Click **More info → Run anyway** to proceed. Auto-update itself works on unsigned builds.

Your data lives in `%APPDATA%\tally\tally.db` regardless of which build you use (NSIS, portable, or `npm run dev`) and survives updates. Backups are written to `%APPDATA%\tally\backups\` on every boot and quit; you can also export everything as JSON via `Arquivo > Exportar dados`.

If an update never arrives, `%APPDATA%\Tally\logs\main.log` records what the updater found — the version it saw, the URL it queried, and any error.

---

## Getting started (development)

> **Prerequisites:** Node.js 20 LTS and npm.

```bash
git clone https://github.com/JulianoMRA/tally.git
cd tally
npm install
npm run dev
```

Useful scripts:

```bash
npm run dev            # Electron + Vite with hot reload
npm run test:run       # Vitest single run
npm run test:coverage  # Vitest with coverage (80% domain / 60% global gates)
npm run e2e            # Playwright E2E (requires npm run build first)
npm run lint           # ESLint
npm run typecheck      # tsc -b --noEmit (includes e2e specs)
npm run dist           # Windows installer + portable via electron-builder
```

---

## Project documentation

| Document                               | Purpose                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| [`PRD.md`](./PRD.md)                   | Product requirements, business rules (RN-01..RN-08), data model, full roadmap |
| [`CHANGELOG.md`](./CHANGELOG.md)       | Technical history of every delivered slice                                    |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Setup, conventions, commit standards, test guidelines                         |
| [`SECURITY.md`](./SECURITY.md)         | Electron hardening posture and data-safety notes                              |

---

## About the author

Built by [Juliano Melo Rodrigues Alencar](https://github.com/JulianoMRA), Computer Science student at UFC (Universidade Federal do Ceará). Currently pursuing a QA / Test Automation Engineering internship in Brazil.

---

## License

[MIT](./LICENSE)
