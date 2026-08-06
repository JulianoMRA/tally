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
7. Rode `npm run e2e` quando a mudança for visível na UI
8. Abra PR contra `main` com o gate local verde

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
npm run smoke:visual   # Folha de contato: 35 capturas do app em 3 larguras (precisa de build)
npm run gen:icon       # Regenera build/icon.ico a partir do SVG do brand
```

---

## Log do main process

O main escreve em `<userData>/logs/main.log` via `electron-log`
(`%APPDATA%\Tally\logs\main.log` no Windows; em E2E vai para o diretório
isolado do `TALLY_USER_DATA`). É o primeiro lugar a olhar quando o auto-update
não se comporta: o logger do `electron-updater` está plugado nele e registra a
versão encontrada, a URL consultada e o progresso do download.

O motivo de existir: uma checagem que falhava com 404 deixou o app instalado
sem atualizar **em silêncio**, porque o `catch` do boot só fazia
`console.error` e binário empacotado não tem console.

## Nomes dos artefatos

O `artifactName` do NSIS é `${productName}-Setup-${version}.${ext}`, e não o
default com espaços. O `latest.yml` que o electron-builder gera referencia o
instalador por URL, onde espaço não sobrevive — com o default, o arquivo saía
como `Tally Setup X.Y.Z.exe` e era preciso renomear à mão antes de subir, senão
o electron-updater baixava uma URL inexistente. Agora o nome gerado já é o nome
que o `latest.yml` referencia.

---

## Estratégia de testes

- **Unit** (`Vitest`) — `src/**/__tests__/*.test.ts`. Domain layer com TDD.
- **Integration** (`Vitest + SQLite em memória`) — `src/persistence/__tests__/`.
- **E2E** (`Playwright + _electron`) — `e2e/*.spec.ts`. Cada teste recebe
  uma pasta `userData` isolada via fixture (`TALLY_USER_DATA`).

Coverage mínima (thresholds no `vitest.config.ts`): **80% no domain**
(RN-01..RN-08), **60% global**. `npm run test:coverage` falha abaixo disso.

### `.only` é barrado

Vitest e Playwright quebram se encontrarem um teste focado (`it.only`,
`test.only`). É proposital: um `.only` esquecido deixa a suíte **verde testando
quase nada** — no vitest, um único `it.only` fez o run passar com
`693 passed | 13 skipped` e exit 0.

Para depurar um teste isolado, use a escotilha:

```bash
TALLY_ALLOW_ONLY=1 npm run test:run
```

A mesma variável vale para `npm run e2e` e para o Stryker. Prefira, quando der,
filtrar sem `.only` — `npx playwright test e2e/smoke.spec.ts` ou
`npx vitest run -t "nome do teste"` — porque aí não há o que esquecer no commit.

---

## Pipeline local

O projeto não usa CI hospedada — os workflows do GitHub Actions foram removidos
em ago/2026. Todo o pipeline roda na máquina, na ordem abaixo, antes de abrir PR:

1. `npm run lint`
2. `npm run typecheck` (inclui os specs E2E)
3. `npm run test:coverage` (thresholds RNF-06)
4. `npm run build`
5. `npm run e2e` (requer o build acima)
6. `npm run test:mutation` (Stryker no domain; lento, rode ao mexer em regra de negócio)
7. `npm audit --omit=dev --audit-level=high` (dependências de produção)

Os hooks do Husky cobrem a parte rápida automaticamente: `pre-commit` roda
ESLint e Prettier nos arquivos staged, `commit-msg` valida o conventional
commit, e `pre-push` roda typecheck + suíte unitária.

PR contra `main` segue obrigatório para merge — o que mudou é que a verificação
é sua responsabilidade local, não de um runner.

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
