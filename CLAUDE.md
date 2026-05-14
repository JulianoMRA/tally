# CLAUDE.md

Guia operacional do Claude Code para este projeto. Leia antes de qualquer alteração.

---

## 1. Contexto

App desktop pessoal para controle financeiro mensal, com geração automática de parcelas, faturas, ajudas (cobranças a terceiros) e rendas recorrentes. Substitui uma planilha que era duplicada manualmente todo mês.

Projeto de uso pessoal e também peça de portfólio para vaga de QA / Test Automation Engineer. **Qualidade de testes e CI tem peso igual ao da feature em si.**

Detalhes completos do produto, requisitos, regras de negócio e roadmap estão em `PRD.md`. Consulte sempre que houver dúvida sobre escopo ou comportamento esperado.

---

## 2. Stack

| Camada | Tecnologia | Versão alvo |
|--------|------------|-------------|
| Runtime | Node.js | 20 LTS |
| Empacotamento | Electron | 30+ |
| Bundler | Vite | 5+ |
| UI | React | 18+ |
| Linguagem | TypeScript | 5+ (strict mode) |
| Banco de dados | SQLite via better-sqlite3 | 11+ |
| Migrations | Sistema próprio em SQL puro (versionado) | — |
| Testes unitários | Vitest | 1+ |
| Testes E2E | Playwright | 1+ |
| Lint | ESLint + @typescript-eslint | — |
| Formatação | Prettier | — |
| Commits | commitlint + Husky + lint-staged | — |
| CI | GitHub Actions | — |

Sistemas alvo: Windows (primário) e Linux (secundário). macOS não é prioridade.

---

## 3. Estrutura de pastas

```
.
├── .github/workflows/         # CI pipelines
├── electron/                  # Main process do Electron
│   ├── main.ts                # Entry point
│   ├── preload.ts             # Bridge IPC
│   └── ipc/                   # Handlers IPC organizados por domínio
├── src/
│   ├── domain/                # Regras de negócio puras (sem dependências externas)
│   │   ├── entities/          # Tipos e classes de entidade
│   │   ├── services/          # Casos de uso e cálculos (RN-01..RN-08)
│   │   └── __tests__/         # Testes do domínio
│   ├── persistence/           # Repositórios + migrations + setup do SQLite
│   │   ├── migrations/        # SQL versionado, nomeado NNNN_descricao.sql
│   │   ├── repositories/      # Um arquivo por entidade
│   │   └── __tests__/         # Testes de integração com SQLite em memória
│   ├── renderer/              # React app (renderer process)
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── features/          # Páginas/telas agrupadas por feature
│   │   ├── hooks/             # Hooks customizados
│   │   ├── lib/               # Utilitários do renderer (formatação, etc.)
│   │   └── main.tsx           # Entry point do React
│   └── shared/                # Tipos compartilhados entre main e renderer
├── e2e/                       # Testes Playwright
├── PRD.md                     # Documento de requisitos
├── CLAUDE.md                  # Este arquivo
└── README.md                  # Apresentação do projeto (portfólio)
```

---

## 4. Arquitetura

### 4.1 Camadas
1. **Domain** (`src/domain/`): regras de negócio puras. Funções determinísticas, sem I/O, sem dependências de Electron ou SQLite. É aqui que vivem RN-01 a RN-08 do PRD.
2. **Persistence** (`src/persistence/`): repositórios que falam SQL. Cada repositório expõe métodos do tipo `findById`, `list`, `create`, `update`, `delete` retornando entidades do domain. Migrations versionadas e aplicadas no boot.
3. **Main process** (`electron/`): orquestra IPC, ciclo de vida da janela, abertura do banco. Handlers IPC chamam services do domain passando repositórios.
4. **Renderer** (`src/renderer/`): React. Comunica com o main via IPC tipado (preload com contextBridge). Não fala diretamente com SQLite.

### 4.2 Comunicação IPC
- Preload expõe um objeto `api` tipado via `contextBridge.exposeInMainWorld`.
- Cada handler IPC tem um par tipado: `IpcRequest` e `IpcResponse`.
- Tipos compartilhados ficam em `src/shared/`.
- Nunca passar objetos não-serializáveis pelo IPC.

### 4.3 Dependências entre camadas
Renderer → IPC → Main → Domain → Persistence. **Nunca o contrário.** Domain não conhece Persistence (recebe via injeção). Persistence não conhece Domain além das entidades.

---

## 5. Convenções de código

### 5.1 TypeScript
- `strict: true` em `tsconfig.json`. Sem `any` exceto em adapters de bibliotecas sem tipos (e mesmo aí, encapsular).
- Sem `// @ts-ignore` ou `// @ts-expect-error` sem comentário explicativo do motivo.
- Use `unknown` no lugar de `any` quando o tipo é genuinamente desconhecido.
- Discriminated unions para representar estados (ex: `type Status = { kind: 'Aberta' } | { kind: 'Paga'; pagaEm: Date }`).

### 5.2 Naming
- Arquivos: `kebab-case.ts`. Componentes React: `PascalCase.tsx`.
- Tipos e classes: `PascalCase`. Variáveis e funções: `camelCase`. Constantes: `SCREAMING_SNAKE_CASE`.
- Domínio em português (`Despesa`, `Fatura`, `Parcela`, `calcularFaturaDaCompra`). Infra em inglês (`repository`, `migration`, `handler`).

### 5.3 Estilo
- Prettier configurado com defaults razoáveis: aspas simples, sem semicolons no fim de linha (a definir no setup; o importante é consistência).
- ESLint com `@typescript-eslint/recommended` + `react-hooks`.
- Imports ordenados (interno por feature, depois externo, depois relativo). Pode usar `eslint-plugin-import` para automatizar.

### 5.4 Testes
- Pasta `__tests__` co-localizada com o código testado.
- Nome do arquivo de teste: `<arquivo>.test.ts`.
- AAA (Arrange-Act-Assert) com comentários explícitos em testes complexos.
- Cada `describe` representa uma unidade (função ou classe). Cada `it` representa um caso ou cenário.
- Fixtures e builders em `src/domain/__tests__/__fixtures__/`.

---

## 6. Regras invioláveis

Estas regras são **absolutas**. Caso uma instrução conflite com elas, o Claude Code deve pausar e pedir confirmação explícita ao usuário antes de prosseguir.

1. **TDD obrigatório no domain layer.** Toda regra de negócio (RN-XX do PRD) começa com um teste falhando. A implementação vem depois. Sem exceção.
2. **Conventional Commits.** Toda mensagem de commit segue o padrão `tipo(escopo): descrição`. Tipos permitidos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `style`. Escopo opcional (ex: `feat(fatura): adiciona ciclo de vida`).
3. **Sem ações irreversíveis sem confirmação.** Excluir arquivos, dropar tabelas, sobrescrever migrations existentes, fazer force push, rebase de branches com commits compartilhados — sempre pedir confirmação explícita primeiro.
4. **Migrations são imutáveis após aplicadas.** Uma migration aplicada em qualquer ambiente nunca é editada. Mudanças no schema vão em migration nova.
5. **Tipagem em IPC é obrigatória.** Toda comunicação entre main e renderer passa por tipos compartilhados em `src/shared/`. Nada de `any` ou `unknown` nos contratos.
6. **Branches a partir da main.** Cada slice (ou subtarefa) em sua branch própria nomeada `slice-NN-descricao` ou `feat/<nome>`. PR obrigatório para merge. CI verde obrigatório.
7. **Não commitar segredos.** Mesmo que o projeto não tenha API keys hoje, manter `.gitignore` robusto. Nunca commitar `.env`, arquivos `.db`, ou `node_modules`.
8. **Domain sem dependências externas.** Nada de import de Electron, SQLite, fs ou date-fns dentro de `src/domain/`. Use injeção quando precisar.

---

## 7. Fluxo de trabalho

### 7.1 Iniciando uma nova feature ou slice
1. Confirmar com o usuário qual slice/feature está sendo iniciada.
2. Criar branch a partir da `main` atualizada.
3. Identificar quais regras do PRD (RN-XX, RF-XX) estão envolvidas.
4. Escrever testes do domain primeiro (se aplicável).
5. Implementar.
6. Atualizar README ou docs se a feature for visível externamente.
7. Rodar localmente: `npm run lint && npm run typecheck && npm run test && npm run build`.
8. Commit conforme conventional commits.
9. Abrir PR. CI deve passar antes de merge.

### 7.2 Antes de cada commit
- Lint sem warnings novos.
- Typecheck verde.
- Testes do escopo afetado passando.
- Commit message no formato convencional.

### 7.3 Antes de abrir PR
- Pipeline local completo verde.
- Branch rebaseada na main atual.
- Descrição do PR cita os RF/RN do PRD cobertos.

---

## 8. Glossário do domínio

Termos usados no código e nas conversas — sempre em português, sempre com este significado.

| Termo | Significado |
|-------|-------------|
| **Cartão** | Cartão de crédito do usuário (Inter, Nubank). Tem dia de fechamento e dia de vencimento. |
| **Fatura** | Conjunto de parcelas vinculadas a um cartão em um mês de referência. Tem ciclo de vida Aberta → Fechada → Paga. |
| **Despesa** | Registro mestre de uma compra ou compromisso financeiro. Pode ser Única, Parcelada ou Assinatura. |
| **Parcela** | Ocorrência mensal de uma despesa. Despesa única tem 1 parcela. Parcelada tem N parcelas. Assinatura tem ocorrências geradas continuamente. |
| **Contribuidor** | Terceiro que paga parte de uma despesa (pai, mãe, amigo). |
| **Ajuda** | Vínculo entre um contribuidor e uma parcela, com valor e status (Pendente/Recebida). Não é receita — é abatimento. |
| **Ajuda recorrente** | Ajuda replicada automaticamente em todas as ocorrências futuras de uma despesa parcelada ou assinatura. |
| **Renda** | Fonte de entrada financeira. Pode ser Recorrente (Bolsa PET, mesada) ou Avulsa (freela). |
| **Recebimento** | Ocorrência individual de uma renda. Para recorrentes, gerado mês a mês. |
| **Mês de referência** | Mês calendário (yyyy-mm) usado para agrupar visualmente faturas, gastos fora de cartão e recebimentos. |
| **Data de fechamento** | Dia do mês em que o cartão "fecha" e novas compras passam para a fatura seguinte. |
| **Data de vencimento** | Dia do mês em que a fatura deve ser paga. |
| **Forma de pagamento** | Crédito (vai pra fatura de um cartão), Débito, Pix ou Dinheiro (não geram fatura). |
| **Adiantamento de parcela** | Mover parcelas mais futuras para uma fatura mais próxima. Numeração X/Y é preservada. |

---

## 9. O que NÃO fazer sem confirmação explícita

- Apagar arquivos do disco ou pastas.
- Dropar tabelas ou colunas.
- Editar migration já aplicada (criar nova migration em vez disso).
- Fazer `git push --force`, `git rebase -i` em branches compartilhadas, ou `git reset --hard` que descarte trabalho.
- Adicionar dependências pesadas (>5MB no bundle) sem justificativa.
- Trocar a stack ou versão major de qualquer biblioteca listada na seção 2.
- Mudar regras de negócio do PRD. Se o que está pedido contradiz o PRD, parar e perguntar.
- Adicionar funcionalidades fora do escopo do slice atual (escopo creep). Anotar como TODO/Issue e prosseguir.
- Desabilitar ou pular testes para "fazer passar". Investigar e corrigir.

---

## 10. Comandos comuns

Os comandos exatos serão definidos no `package.json` durante o setup (slice 0). Padrão esperado:

```bash
npm run dev            # Dev mode (Electron + Vite hot reload)
npm run build          # Build de produção
npm run lint           # ESLint
npm run lint:fix       # ESLint com --fix
npm run typecheck      # tsc --noEmit
npm run test           # Vitest (watch)
npm run test:run       # Vitest single run
npm run test:coverage  # Vitest com cobertura
npm run e2e            # Playwright
npm run migrate        # Aplica migrations pendentes
npm run migrate:new    # Cria migration vazia versionada
```

---

## 11. Observações finais

- Quando em dúvida sobre intent ou comportamento esperado, **pergunte antes de implementar**. Custo de pergunta < custo de retrabalho.
- Mantenha o PRD vivo: se uma decisão de implementação revelar lacuna ou ambiguidade no PRD, atualize o documento no mesmo PR.
- Cada slice merge gera uma nota curta no README (changelog informal de progresso visível para portfólio).
