# PRD — App Desktop de Controle Financeiro Pessoal

> **Status:** Em desenvolvimento ativo.
> **Owner:** Juliano Melo Rodrigues Alencar
> **Última atualização:** 24 de maio de 2026 (Slice 15 — hardening, QA e cleanup pós-MVP)
>
> **Mudanças no Slice 15:** isolação E2E (sem mais poluição do banco real),
> hardening do Electron (CSP estrita, contextIsolation, sandbox), consolidação
> de row-mappers, fim de mutate-on-read em `FaturaRepository.list`, schemas
> Zod em todos os canais IPC, `parcela.data_referencia` normalizada para
> `YYYY-MM-DD` (migration 0004), drop de colunas mortas `categoria.icone` e
> `renda.categoria_id` (migration 0003), `noImplicitAny` reativado, CI em
> matriz Windows+Ubuntu com E2E e coverage gating. Modelo de dados (seção 6)
> revisado para refletir o schema real.
>
> **Mudança no Slice 12.1:** Ajudas, Contribuidores, ícones de Categoria e
> categoria em Renda foram **removidos** do escopo. Cobranças a terceiros agora
> são tratadas como rendas avulsas. Detalhes na seção 9 (Roadmap).

---

## 1. Visão

App desktop pessoal que substitui a planilha mensal de controle financeiro, eliminando o trabalho manual de duplicar a aba do mês anterior e incrementar parcelas. Diferenciais frente à planilha: geração automática de parcelas, projeção de meses futuros, categorização configurável, dashboard de cobranças (ajudas a receber) e relatórios visuais.

Projeto pessoal com dupla função: ferramenta de uso real e peça de portfólio alinhada à transição de carreira para QA / Test Automation Engineer.

---

## 2. Persona

Usuário único: o próprio dono do projeto. Estudante de Computação com receita mista (bolsa fixa + ajudas familiares + eventuais entradas variáveis), gastos parcelados em dois cartões de crédito (Banco Inter e Nubank) e gastos pontuais fora do cartão (Pix, débito, dinheiro). Algumas despesas têm contribuição parcial de terceiros, que são cobrados manualmente no vencimento da fatura.

---

## 3. Escopo

### 3.1 MVP

- Cadastro configurável de cartões, categorias, contribuidores e fontes de renda
- Despesas em três modalidades: única, parcelada e assinatura
- Suporte a despesas fora de cartão (Pix, débito, dinheiro)
- Cadastro de parcelamentos já em andamento (essencial para migração inicial dos dados da planilha)
- Adiantamento e cancelamento de parcelas futuras
- Fatura como entidade com ciclo de vida (Aberta → Fechada → Paga)
- ~~Ajudas vinculadas a parcelas, com dashboard "A Receber por Pessoa"~~ (removido no Slice 12.1)
- Recebimentos de renda fixos (recorrentes) e avulsos
- Visão mensal consolidada (faturas + gastos fora de cartão + entradas + saldo)
- Navegação multi-mês com projeção de meses futuros baseada em parcelas e assinaturas ativas
- Categorização configurável e relatórios visuais (gráficos por categoria, evolução temporal)

### 3.2 V2 (pós-MVP)

- Orçamento e metas por categoria com alerta de estouro
- Exportação (CSV, PDF mensal)
- Backup e sincronização (a definir: arquivo local exportável, nuvem)
- Tags e notas livres em despesas

### 3.3 Fora de escopo

- Multi-usuário e autenticação
- Integração com bancos (Open Finance)
- Versão mobile ou web
- Multi-moeda (apenas BRL)
- Multi-idioma (apenas pt-BR)

---

## 4. Requisitos Funcionais

### 4.1 Cartões (RF-CAR)

- **RF-CAR-01** — Cadastrar cartão com nome, dia de fechamento (1–31), dia de vencimento (1–31), cor de identificação e flag ativo.
- **RF-CAR-02** — Editar e arquivar (soft delete) cartões. Cartão arquivado não aparece em formulários de despesa, mas seu histórico permanece visível.
- **RF-CAR-03** — Listar cartões ativos com indicadores: total da fatura aberta, próximo vencimento.

### 4.2 Categorias (RF-CAT)

- **RF-CAT-01** — Cadastrar categoria com nome, tipo (Despesa, Renda ou Ambos) e cor.
- **RF-CAT-02** — Editar e arquivar categorias. Despesas vinculadas a categoria arquivada continuam exibindo a categoria com indicador de inativa.

### 4.3 Despesas (RF-DES)

- **RF-DES-01** — Cadastrar despesa **única** com: descrição, categoria, forma de pagamento (Crédito, Débito, Pix, Dinheiro), cartão (se crédito), valor, data da compra.
- **RF-DES-02** — Cadastrar despesa **parcelada** com: campos da única + total de parcelas + valor por parcela. O sistema gera N parcelas e vincula cada uma à fatura correta com base na regra de fechamento do cartão.
- **RF-DES-03** — Cadastrar despesa parcelada **em andamento** com: número da parcela atual (ex: 7/12). O sistema gera apenas as parcelas restantes (5 no exemplo).
- **RF-DES-04** — Cadastrar despesa do tipo **assinatura**: gera ocorrência mensal recorrente sem fim definido até ser cancelada.
- **RF-DES-05** — **Adiantar parcelas**: selecionar uma despesa parcelada e quantas parcelas adiantar. As N parcelas mais futuras são movidas para uma fatura escolhida (default: fatura aberta corrente). A numeração `X/Y` original é preservada.
- **RF-DES-06** — **Cancelar parcelas futuras** de uma despesa parcelada (caso de estorno).
- **RF-DES-07** — **Cancelar assinatura**: para de gerar ocorrências futuras a partir do mês seguinte ao cancelamento.
- **RF-DES-08** — Editar valor das parcelas restantes (caso de reajuste de assinatura).
- **RF-DES-09** — Excluir despesa: requer confirmação explícita. Exclusão é bloqueada se houver parcela paga ou parcela em fatura Fechada/Paga (apenas arquivamento).
- **RF-DES-10** — Editar despesa (Única/Parcelada): descrição e categoria sempre; data apenas para Única em fatura Aberta (move fatura via RN-01). Bloqueia se houver parcela paga. Novo valor é redistribuído apenas entre parcelas pendentes em fatura Aberta ou sem fatura (parcelas em fatura Fechada/Paga preservam o valor). Única com a parcela em fatura Fechada não aceita mudança de valor nem de data.

### 4.4 Faturas (RF-FAT)

- **RF-FAT-01** — Faturas são geradas automaticamente para cada cartão a cada mês de referência conforme parcelas vão sendo vinculadas.
- **RF-FAT-02** — Cada fatura tem status `Aberta` (recebendo novas despesas), `Fechada` (passou da data de fechamento, sem novas despesas) e `Paga` (registrada como paga pelo usuário).
- **RF-FAT-03** — Visualizar fatura com lista de parcelas, total bruto, total de ajudas vinculadas, total líquido a pagar.
- **RF-FAT-04** — Marcar fatura como paga. Ação requer confirmação. Após paga, fatura não permite mais edição de parcelas nem recebe novas parcelas (inclusive cadastro retroativo — bloqueado com erro claro).
- **RF-FAT-05** — Reabrir fatura paga (caso de erro): requer confirmação. A fatura reabre como `Aberta` se a data de fechamento ainda não passou, ou como `Fechada` caso contrário (RN-06).

### 4.5 ~~Contribuidores e Ajudas (RF-AJU)~~

> **Removido no Slice 12.1.** Cobranças a terceiros passam a ser registradas
> como Rendas Avulsas (RF-REN-04). Os requisitos RF-AJU-01..06 foram
> descontinuados em 20/05/2026 junto com a tabela `ajuda` e `contribuidor`.

### 4.6 Rendas e Recebimentos (RF-REN)

- **RF-REN-01** — Cadastrar fonte de renda com nome, tipo (Avulsa ou Recorrente), valor padrão, dia esperado de recebimento (se recorrente) e flag ativo.
- **RF-REN-02** — Renda recorrente gera recebimentos esperados para os próximos N meses (configurável, default 12).
- **RF-REN-03** — Marcar recebimento como recebido, com data efetiva.
- **RF-REN-04** — Cadastrar recebimento avulso (freela, presente, etc.) sem fonte recorrente vinculada. Internamente cria uma fonte Avulsa com o mesmo nome; excluir o último recebimento dessa fonte exclui a fonte junto (sem órfãs na lista de rendas).
- **RF-REN-05** — Editar valor padrão da fonte recorrente afeta recebimentos futuros ainda não recebidos.
- **RF-REN-06** — Editar fonte de renda: nome, valor padrão e (Recorrente) dia esperado. Mudar dia esperado recalcula `data_esperada` dos recebimentos Esperado, clampando ao último dia de meses curtos. Recebidos preservam.

### 4.7 Visão Mensal e Multi-Mês (RF-VIS)

- **RF-VIS-01** — Mês de referência segue o calendário (Junho/2026 agrupa fatura Inter venc 12/06, fatura Nubank venc 22/06, gastos fora de cartão de 01–30/06 e recebimentos de 01–30/06).
- **RF-VIS-02** — Tela mensal mostra: faturas do mês, gastos fora de cartão, recebimentos, ajudas a receber, balanço final (entradas − gastos líquidos).
- **RF-VIS-03** — Navegação entre meses (anterior/próximo) e seletor direto de mês/ano.
- **RF-VIS-04** — Projeção: visualizar mês futuro com parcelas e assinaturas ativas já calculadas e recebimentos recorrentes esperados.
- **RF-VIS-05** — Comparativo: visualizar últimos 6 ou 12 meses com gráfico de evolução de entradas, gastos e saldo.
- **RF-VIS-06** — Relatórios por categoria: pizza de gastos no mês, ranking de categorias, evolução temporal de uma categoria específica.

---

## 5. Requisitos Não-Funcionais

- **RNF-01** — Aplicação desktop offline-first. Banco SQLite local.
- **RNF-02** — Sistemas alvo: Windows (primário, ambiente do dono), Linux (secundário, opcional). macOS não é prioridade.
- **RNF-03** — Tempo de inicialização < 3s em hardware modesto.
- **RNF-04** — Operações de leitura na visão mensal < 200ms para até 10 anos de histórico.
- **RNF-05** — Idioma: pt-BR. Moeda: BRL. Formato de data: dd/MM/yyyy.
- **RNF-06** — Cobertura mínima de testes: 80% no domain layer, 60% global.
- **RNF-07** — CI verde obrigatório para merge: lint + typecheck + testes unitários + build.

---

## 6. Modelo de Dados

Resumo das entidades. Detalhes de tipos e índices ficam na implementação das migrations.
Valores monetários são armazenados como `INTEGER` em centavos (evita ponto flutuante).
Datas: `TEXT` ISO-8601. `mes_referencia` é `YYYY-MM`; demais datas são `YYYY-MM-DD`.

### Cartao

`id, nome, dia_fechamento (1–31), dia_vencimento (1–31), cor, ativo, created_at, updated_at`

### Fatura

`id, cartao_id, mes_referencia (YYYY-MM), data_fechamento (YYYY-MM-DD), data_vencimento (YYYY-MM-DD), status (Aberta|Fechada|Paga), data_pagamento (nullable), created_at, updated_at`

Unique constraint: `(cartao_id, mes_referencia)`.
Total da fatura é calculado em tempo de leitura (soma das parcelas vinculadas) — não persistido.

### Categoria

`id, nome, tipo (Despesa|Renda|Ambos), cor, ativo, created_at, updated_at`

> Coluna `icone` removida na migration 0003 (era código morto desde Slice 12.1).

### Despesa

`id, descricao, categoria_id, tipo (Unica|Parcelada|Assinatura), forma_pagamento (Credito|Debito|Pix|Dinheiro), cartao_id (nullable se forma_pagamento ≠ Credito), valor_centavos, total_parcelas (nullable para Assinatura), data_compra, ativa, created_at, updated_at`

Nota: `valor_centavos` é o valor de cada ocorrência. Para Única, igual ao valor total. Para Parcelada, valor de cada parcela. Para Assinatura, valor mensal.
CHECK constraint: `forma_pagamento = 'Credito'` ⇔ `cartao_id IS NOT NULL`.

### Parcela

`id, despesa_id, fatura_id (nullable se forma_pagamento ≠ Credito), numero, total (nullable para Assinatura), valor_centavos, data_referencia (YYYY-MM-DD), status (Pendente|Paga), data_pagamento (nullable), created_at, updated_at`

`data_referencia` sempre `YYYY-MM-DD` (normalizado na migration 0004). Para parcelas de Parcelada/Assinatura, usa-se dia `01` do mês de referência da fatura.

### Renda

`id, nome, tipo (Avulsa|Recorrente), valor_padrao_centavos, dia_esperado (1–31, nullable para Avulsa), ativa, created_at, updated_at`

> Coluna `categoria_id` removida na migration 0003 (cobranças a terceiros viraram rendas avulsas — Slice 12.1).
> CHECK: `tipo = 'Recorrente'` ⇒ `dia_esperado IS NOT NULL`.

### Recebimento

`id, renda_id (nullable), valor_centavos, data_esperada, data_recebida (nullable), status (Esperado|Recebido), created_at, updated_at`

---

## 7. Regras de Negócio Críticas

### RN-01 — Cálculo da fatura de uma compra

Dada uma compra com `data_compra` em um cartão com `dia_fechamento = F`:

- Se `dia(data_compra) < F`: compra entra na fatura cujo `data_fechamento` é F do **mesmo mês**.
- Se `dia(data_compra) >= F`: compra entra na fatura cujo `data_fechamento` é F do **mês seguinte**.

> A fatura fecha no **início** do dia F (RN-06 marca `Fechada` quando
> `data_fechamento <= hoje`), então a compra feita no próprio dia F já
> pertence ao ciclo seguinte. Regra ajustada em 15/07/2026 — antes era
> `dia <= F → mesmo mês`, o que contradizia RN-06 no dia do fechamento.

Exemplo Inter (F=05, V=12):

- Compra 03/06 → fatura fecha 05/06, vence 12/06
- Compra 05/06 (dia do fechamento) → fatura fecha 05/07, vence 12/07
- Compra 07/06 → fatura fecha 05/07, vence 12/07

Exemplo Nubank (F=15, V=22):

- Compra 10/06 → fatura fecha 15/06, vence 22/06
- Compra 20/06 → fatura fecha 15/07, vence 22/07

### RN-02 — Geração de parcelas

Ao cadastrar despesa parcelada com `total_parcelas = N` e parcela inicial = `K` (default 1):

- Gera `N - K + 1` parcelas numeradas `K/N, K+1/N, ..., N/N`.
- A primeira parcela é vinculada à fatura calculada via RN-01 a partir da `data_compra`.
- Cada parcela subsequente é vinculada à fatura do mês seguinte da parcela anterior (mesmo cartão).

### RN-03 — Adiantamento de parcelas

Ao adiantar M parcelas de uma despesa:

- Adiantamento é exclusivo de despesa Parcelada de crédito (Única e Assinatura não adiantam).
- Identifica as M parcelas pendentes mais futuras (maior numero). Parcelas Paga ou em fatura Fechada/Paga não são elegíveis.
- Move o `fatura_id` dessas parcelas para a fatura de destino (default: fatura aberta corrente do mesmo cartão). A fatura de destino deve estar Aberta.
- Mantém a numeração original.
- Recalcula totais das faturas afetadas (origem e destino).

### RN-04 — Geração de ocorrências de assinatura

Despesa do tipo Assinatura gera ocorrências mês a mês conforme o tempo avança ou conforme o usuário navega para meses futuros (geração preguiçosa). Mantém-se um horizonte de 12 meses adiante.

### ~~RN-05 — Ajuda recorrente~~

> Removida no Slice 12.1 junto com toda a feature de Ajudas.

### RN-06 — Ciclo de vida da fatura

- `Aberta`: data atual < `data_fechamento`. Aceita novas parcelas.
- `Fechada`: `data_fechamento <= data atual < data_vencimento` ou usuário fechou manualmente. Não aceita novas parcelas (nem como destino de adiantamento). Parcelas dentro dela não recebem redistribuição de valor nem mudança de data, e a despesa correspondente não pode ser excluída.
- `Paga`: usuário registrou pagamento. Imutável exceto via reabertura. Não aceita novas parcelas — cadastro retroativo em mês de fatura paga exige reabrir a fatura antes (em fatura `Fechada` o cadastro retroativo é permitido, para suportar migração de dados).

Pagar a fatura marca todas as parcelas dela como `Paga` (com a mesma data de pagamento); reabrir reverte as parcelas para `Pendente` e devolve a fatura para `Aberta` — ou para `Fechada`, quando `data_fechamento` já passou (a reabertura não pode ressuscitar uma fatura vencida como se ainda aceitasse compras). É essa sincronização que arma os bloqueios de RF-DES-09/10.

### RN-07 — Cálculo do total da fatura

`total = soma(valor_parcela onde parcela.fatura_id = fatura.id)`.

> Anteriormente havia subtração de ajudas (`líquido = bruto − ajudas`); removida
> no Slice 12.1 junto com a feature de Ajudas.

### RN-08 — Balanço mensal

`saldo = soma(recebimentos do mês) - (soma(faturas do mês) + soma(gastos fora de cartão do mês))`.

---

## 8. Estratégia de QA

### 8.1 Testes unitários (Vitest)

- **Cobertura mínima**: 80% no domain layer (regras de negócio RN-01 a RN-08), 60% global.
- **Foco**: cálculo de fatura por data de compra (RN-01), geração de parcelas (RN-02), adiantamento (RN-03), geração de ocorrências de assinatura (RN-04), ciclo de vida da fatura (RN-06), total da fatura (RN-07), balanço mensal (RN-08).
- **TDD obrigatório** no domain layer: teste antes da implementação.

### 8.2 Testes de integração (Vitest + node-sqlite3-wasm em memória)

- Repositórios contra SQLite em memória.
- Fluxos completos: cadastrar despesa parcelada → verificar parcelas geradas → adiantar → verificar faturas recalculadas.

### 8.3 Testes E2E (Playwright)

Cada teste roda contra uma instância isolada do app: a fixture em `e2e/fixtures/electron-app.ts` cria uma pasta `userData` temporária (via `TALLY_USER_DATA`) e a remove ao fim — testes nunca tocam na base real do usuário.

Fluxos críticos cobertos:

- Cadastrar cartão e categoria (CRUD)
- Cadastrar despesa única e visualizar fatura
- Cadastrar despesa parcelada nova
- Cadastrar despesa parcelada em andamento (migração)
- Cadastrar, reajustar e cancelar assinatura
- Excluir despesa (RF-DES-09)
- Pagar fatura bloqueia exclusão da despesa; reabrir libera (RN-06)
- Cadastrar gasto fora de cartão (Pix/Débito/Dinheiro)
- Cadastrar e marcar recebimento de renda (recorrente + avulso)
- Visão mensal consolidada
- Navegação entre meses com projeção (RF-VIS-04)
- Relatórios e gráficos (RF-VIS-05, RF-VIS-06)

### 8.4 CI/CD (GitHub Actions)

Pipeline em PR e push para main, em matriz `ubuntu-latest + windows-latest`:

1. Install dependencies (com cache)
2. Lint (ESLint)
3. Typecheck (`tsc --noEmit`)
4. Test (`vitest run --coverage` — thresholds RNF-06 são gate)
5. Build (Electron build)
6. E2E (`playwright test`, apenas Windows — alvo primário per RNF-02), incluindo
   varredura de acessibilidade (axe-core) nas telas principais — violações
   serious/critical quebram o pipeline
7. Upload de artifacts: `playwright-report` (Windows) e `coverage-report`
   (Ubuntu, também enviado ao Codecov)
8. `npm audit --omit=dev --audit-level=high` **bloqueante**

Workflows adicionais: CodeQL (push/PR/semanal), Dependabot (npm + actions,
semanal) e mutation testing com Stryker no domain layer (semanal + manual —
lento demais para gate de PR).

Determinismo dos E2E: a fixture força a janela para 1280x800 após o launch —
runners de CI têm telas menores e o clamp do SO colapsava grids (colunas 1fr
com largura zero), gerando falhas que não reproduziam localmente.

Branch `main` protegida: PR obrigatório, CI verde obrigatório, conventional commits.

### 8.5 Documentação de bugs

Bugs encontrados durante desenvolvimento ou uso real são registrados como GitHub Issues seguindo template estruturado (preconditions, steps, expected, actual, severity, evidence). Alinhamento com prática de bug reports do roadmap QA.

---

## 9. Roadmap em Vertical Slices

Ordem proposta para implementação. Cada slice é uma fatia ponta-a-ponta (UI + lógica + persistência + testes) que entrega valor incremental.

| #    | Slice                       | Entrega principal                                                                                                                                                     |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | Setup do projeto            | Electron + Vite + React + TS + SQLite + Vitest + Playwright + ESLint + Prettier + Husky + commitlint + GitHub Actions configurado e rodando "Hello World"             |
| 1    | Camada de domínio base      | Migrations, entidades, repositórios base, testes da regra RN-01 (cálculo de fatura por data)                                                                          |
| 2    | Cartões                     | CRUD de cartões com data de fechamento/vencimento                                                                                                                     |
| 3    | Categorias                  | CRUD de categorias com tipo (Despesa/Renda/Ambos)                                                                                                                     |
| 4    | Despesa única + fatura      | Cadastrar gasto avulso em cartão; geração automática de fatura; visualização da fatura                                                                                |
| 4.5  | Identidade visual           | Design system (tokens, fontes Geist, logo, primitivos UI); retrofit das telas dos Slices 1–4                                                                          |
| 5    | Fatura: ciclo de vida       | Fechamento e pagamento de fatura; cálculo de totais                                                                                                                   |
| 6    | Despesa parcelada           | Cadastro completo (nova e em andamento); geração de parcelas; adiantamento; cancelamento                                                                              |
| 7    | Assinatura                  | Cadastro de assinatura; geração de ocorrências; cancelamento                                                                                                          |
| 8    | Despesas fora de cartão     | Pix, débito, dinheiro vinculados ao mês calendário                                                                                                                    |
| 9    | ~~Contribuidores e Ajudas~~ | **Revertido no Slice 12.1.** Cobranças a terceiros viraram rendas avulsas.                                                                                            |
| 10   | Rendas e Recebimentos       | Fontes recorrentes e avulsas; geração de recebimentos esperados; marcar recebido                                                                                      |
| 11   | Visão mensal consolidada    | Tela do mês com faturas + gastos fora + entradas + saldo                                                                                                              |
| 12   | Multi-mês e projeção        | Navegação entre meses; projeção 6/12 meses futuros                                                                                                                    |
| 12.1 | Cleanup e simplificação     | Bugs visuais, RF-DES-09 (excluir despesa), reversão do Slice 9, remoção de ícone de Categoria e categoria em Renda                                                    |
| 13   | Relatórios e gráficos ✅    | Pizza por categoria; evolução temporal; comparativos                                                                                                                  |
| 14   | Hardening ✅                | electron-builder NSIS+portable, RNF-06 (80% domain / 60% global), primitivos Toast/ConfirmDialog/useEscapeKey                                                         |
| 14.1 | Polimento pós-MVP ✅        | Bugs visuais, RF-DES-10 (editar despesa), RF-REN-06 (editar renda), adiantar parcela por linha, ordenação client-side, descrição em FaturaDetalhe, Rendas em 2 Panels |

V2 (orçamento, exportação, backup, tags) entra após o slice 14.

---

## 10. Métricas de sucesso

- **Funcional:** dono do projeto consegue migrar 100% dos dados da planilha atual e abandonar o uso da planilha em até 2 meses após release do MVP.
- **Técnico:** cobertura de testes mantida nos limites definidos; CI verde em 95%+ dos PRs.
- **Portfólio:** projeto público no GitHub com README detalhado, histórico de commits convencionais, testes visíveis, screenshots/GIFs de uso.
