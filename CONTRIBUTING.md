# Contributing

Tally é um projeto pessoal e peça de portfólio QA. Contribuições externas não
são o foco, mas o repositório é público e segue convenções claras para que
qualquer pessoa consiga entender, rodar e modificar.

---

## Pré-requisitos

- **Node.js 20 LTS** (versão exata em `.nvmrc`)
- **npm** (ships com o Node)
- **Windows 10/11** ou **Linux** (macOS não é prioridade)
- **Git** com `core.autocrlf` configurado para seu OS

---

## Setup

```bash
git clone https://github.com/JulianoMRA/tally.git
cd tally
npm install        # instala deps e ativa o Husky via "prepare" script
npm run dev        # inicia Electron + Vite em modo desenvolvimento
```

O banco SQLite vive em `%APPDATA%\Tally\tally.db` (Windows) ou
`~/.config/Tally/tally.db` (Linux). Para isolar dados, defina
`TALLY_USER_DATA` apontando para uma pasta dedicada antes de rodar.

---

## Workflow de slices

Trabalho organizado em **vertical slices**: cada slice é uma fatia
ponta-a-ponta (UI + lógica + persistência + testes) que entrega valor
incremental. Detalhes em [`PRD.md`](./PRD.md) §9 e em
[`CLAUDE.md`](./CLAUDE.md) §7.

1. Atualize `main` (`git fetch && git rebase origin/main`)
2. Crie branch `slice-NN-descricao` ou `feat/<nome>`
3. Identifique RF/RN do PRD cobertos
4. **TDD obrigatório no domain layer** — teste antes da implementação
5. Implemente em commits atômicos seguindo conventional commits
6. Rode o gate local: `npm run lint && npm run typecheck && npm run test:run && npm run build`
7. Abra PR contra `main`; CI verde obrigatório para merge

---

## Conventional Commits

Mensagens seguem [Conventional Commits](https://www.conventionalcommits.org/),
validadas via `commitlint` no `pre-commit` hook.

Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`,
`ci`, `perf`, `style`.

Header limitado a 100 caracteres. Subject case livre (PT-BR ou EN).

Exemplos:

```
feat(fatura): adiciona ciclo de vida Aberta -> Fechada -> Paga
fix(persistence): cancelarPendentes filtra por parcela.status
refactor(renderer): DRY formatBRL/mesAtual (usa src/renderer/lib/)
chore(types): reativa noImplicitAny (alinha com CLAUDE.md "strict")
```

---

## Husky hooks

- **`pre-commit`** → `lint-staged` (ESLint + Prettier nos arquivos staged)
- **`commit-msg`** → `commitlint` valida o header
- **`pre-push`** → `npm run typecheck && npm run test:run` (barra push se
  tipos ou testes unitários quebrarem)

Nunca use `--no-verify` sem justificativa clara — investigue o que o hook
está bloqueando antes.

---

## Scripts

```bash
npm run dev            # Dev mode (Electron + Vite hot reload)
npm run build          # Build de produção
npm run dist           # Build + electron-builder (NSIS + portable)
npm run lint           # ESLint
npm run lint:fix       # ESLint --fix
npm run typecheck      # tsc --noEmit
npm run test           # Vitest (watch)
npm run test:run       # Vitest single run
npm run test:coverage  # Vitest + coverage (gate de CI)
npm run e2e            # Playwright (precisa de npm run build antes)
npm run gen:icon       # Regenera build/icon.ico a partir do SVG do brand
```

---

## Estratégia de testes

- **Unit** (`Vitest`) — `src/**/__tests__/*.test.ts`. Domain layer com TDD.
- **Integration** (`Vitest + SQLite em memória`) — `src/persistence/__tests__/`.
- **E2E** (`Playwright + _electron`) — `e2e/*.spec.ts`. Cada teste recebe
  uma pasta `userData` isolada via fixture (`TALLY_USER_DATA`).

Coverage mínima (gate de CI): **80% no domain** (RN-01..RN-08), **60% global**.

---

## CI

GitHub Actions roda em matriz `ubuntu-latest + windows-latest` em todo PR
e push para `main`:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:coverage` (thresholds RNF-06)
5. `npm run build`
6. `npm run e2e` (apenas Windows)
7. `npm audit --audit-level=high` (não-bloqueante)

Branch protection em `main`: PR obrigatório, CI verde obrigatório.

---

## Migrations

Migrations SQL puras em `src/persistence/migrations/sql/`, nomeadas
`NNNN_descricao.sql`. **Imutáveis** após aplicadas — o runner valida via
checksum SHA-256 e quebra se uma migration aplicada tiver sido alterada.

Para mudar schema, crie migration nova. Para casos que exigem
`DROP TABLE` em tabela referenciada por FK, use
`PRAGMA defer_foreign_keys = ON` no topo (exemplo: 0003).

---

## Documentação relacionada

| Arquivo                          | Função                                           |
| -------------------------------- | ------------------------------------------------ |
| [`PRD.md`](./PRD.md)             | Requisitos, regras de negócio, modelo de dados   |
| [`CLAUDE.md`](./CLAUDE.md)       | Guia operacional: stack, arquitetura, convenções |
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico técnico de cada slice                  |
| [`SECURITY.md`](./SECURITY.md)   | Política de reporte de vulnerabilidades          |
