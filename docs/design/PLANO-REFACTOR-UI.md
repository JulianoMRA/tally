# Plano — Refactor visual (ago/2026)

Plano de execução da proposta de UI em `docs/design/referencia/proposta-2026-08/`.
Origem: auditoria de interface feita sobre `src/renderer` na `main`, sincronizada
em 15/08/2026.

Não confundir com o **plano de UI/UX de 04/08/2026** (8 fases, PRs #76–#83, já
mergeado). Aquele corrigiu 24 pontos de usabilidade dentro dos layouts
existentes. Este reorganiza os layouts.

---

## 1. A tese

> A UI está limpa. O problema é que tudo tem o mesmo peso.

Paleta Cream, Geist e os raios ficam. O que muda é **hierarquia, densidade e
caminho de clique**. A proposta enumera 17 pontos de diagnóstico e cinco
princípios:

1. Uma pergunta por tela — a resposta principal em número grande, no topo
2. Operação ≠ análise — mês corrente e histórico param de disputar a rolagem
3. Lista é a tela, formulário é episódio
4. Uma largura de conteúdo (hoje são três tiers)
5. Peso visual = importância — seis degraus de tipo, três de densidade

## 2. Decisões tomadas (Juliano, 16/08/2026)

| Decisão            | Escolha                                                  |
| ------------------ | -------------------------------------------------------- |
| Largura alvo       | Adaptar para **1266px**. Sem mexer no `BrowserWindow`.   |
| Escopo do lote     | **F1–F3**, depois reavaliar                              |
| Aba Análise        | Confirmada. Pizza sai. Orçamento vira marca no ranking.  |
| Arquivos de design | Commitados em `docs/design/referencia/proposta-2026-08/` |

## 3. Restrições que condicionam todas as fases

### 3.1 O mockup é 1906px; o app abre com 1266px

Os painéis "depois" da proposta foram desenhados a 1906px de viewport (janela
1920 maximizada). `createWindow` usa `width: 1280`, que é tamanho **externo** —
a viewport real é **1266px**. Medido: `setSize(1024)→1010`, `(1280)→1266`,
`(1440)→1426`, `(1760)→1746`.

Descontada a sidebar de 208px, o mockup dispõe de ~1698px de conteúdo; a janela
padrão entrega ~1058px. Todo layout de duas colunas da proposta precisa de um
comportamento definido abaixo do ponto em que ele cabe. Um `@media (min-width:
1280px)` **não dispara** para quem não maximiza.

### 3.2 Os pesos de fonte da proposta não estão importados

`src/renderer/main.tsx` importa Geist 400/500/600 e Geist Mono 400/500 via
`@fontsource`. A proposta usa **700** (títulos e seções) e **800** (o número
grande do hero) de forma central. Sem importar os dois pesos, o navegador
sintetiza o negrito e a tipografia da proposta não se reproduz.

Isto é pré-requisito da F1, não da F8. Fontes são locais, sem CDN — a proposta
usa Google Fonts, mas isso vale só para renderizar o `.dc.html` no navegador.

### 3.3 Dois guards de CSS bloqueiam hex solto

`src/renderer/styles/__tests__/` tem um guard que falha se aparecer hex
hardcoded no CSS de uma feature, e outro que falha se um `var(--x)` sem fallback
não existir em `tokens.css`. As cores novas da proposta — a barra de composição
(`#7fb389`, `#c98a7c`, `#d9b06a`) e a marca de limite do ranking — precisam
virar token antes de serem usadas.

### 3.4 Dois componentes já existentes cobrem parte da proposta

- `SegmentedControl` já suporta `tablist`/`tab` quando troca o conteúdo da tela.
  A aba **Mês / Análise** da F1 não precisa de componente novo.
- `RowActions` já implementa o menu "⋯" com portal, inversão quando não cabe
  abaixo, teclado completo, e a regra de que **ação destrutiva nunca vira botão
  solto na linha**. Cobre "exportar no ⋯" (F1) e "arquivar no ⋯" (F7).

### 3.5 O orçamento não é só leitura

A proposta transforma o limite de categoria numa marca vertical na barra do
ranking. Mas `OrcamentoPanel` também é a **UI de edição** dos limites
(`definirLimite`, `removerLimite`, escopo global vs. mensal). A marca no ranking
cobre a leitura; a edição permanece na aba Análise, que passa a ser o único
lugar onde limites são definidos. Nenhuma capacidade é perdida.

---

## 4. Lote 1 — F1 a F3

### F1 — Visão mensal: hero, agenda e aba Análise

Resolve os pontos 01–07. Branch `feat/refactor-visao-mensal`.

**O problema, confirmado no código:** `VisaoMensalPage.tsx` renderiza os três
cards (Entradas / Faturas / Gastos) na linha 160 e só chega ao `SaldoCard` na
linha 193. A resposta principal aparece em quarto lugar. Os botões Exportar
CSV/PDF ocupam a mesma barra do seletor de mês.

**Domínio (TDD, regra 1):**

- Novo `src/domain/services/montar-agenda-do-mes.ts` — função pura que recebe
  faturas, recebimentos e a data de hoje, e devolve os eventos futuros
  ordenados: fechamento de fatura, vencimento de fatura, recebimento previsto.
  Todos os dados necessários já existem (`Fatura.dataFechamento`,
  `dataVencimento`, `RecebimentoComContexto.dataEsperada`). **Sem migration,
  sem IPC novo.**

**Renderer:**

- `SaldoCard` vira o hero escuro: saldo projetado em 64px sobre `--forest`, com
  o realizado como nota de apoio no mesmo bloco (hoje são dois números
  competindo). RN-08 intacto — só a apresentação muda.
- Barra de composição substitui os três cards soltos: entradas / faturas / fora
  do cartão como proporção e valor de uma vez.
- Novo painel "Ainda vai acontecer" consumindo o service de agenda. Torna o
  projetado auditável: hoje o número depende de eventos invisíveis.
- Aba **Mês / Análise** via `SegmentedControl` em modo `tablist`. Migram para
  Análise: `EvolucaoLineChart`, `EvolucaoCategoriaChart` e `OrcamentoPanel`.
- `CategoriaPieChart` é **removido** (ponto 05 — o ranking já ordena o mesmo
  dado). O componente e seu teste saem do repositório.
- `CategoriaRanking` sobe para a tela do mês e ganha a marca vertical de limite.
- Exportar CSV/PDF migra para um `RowActions` no header.
- Seletor de mês perde a duplicação: o label "Agosto de 2026" repete o que o
  campo já diz.

**Adaptação a 1266px:** o hero (1.35fr) e "Ainda vai acontecer" (1fr) empilham
abaixo do breakpoint. A Visão mensal já usa 1180px como ponto de duas colunas —
reaproveitar esse valor, não introduzir outro.

**Risco:** `e2e/visao-mensal.spec.ts`, `relatorios.spec.ts` e `orcamento.spec.ts`
mudam junto. `a11y.spec.ts` precisa rodar com dados — badge nenhum renderiza na
base vazia, e foi assim que os problemas de contraste apareceram da última vez.

### F2 — `SidePanel`

Pré-requisito de F3, F6 e F7. Branch `feat/side-panel`. PR próprio, pequeno.

Painel lateral sobreposto, com `useFocusTrap` e `useEscapeKey` (ambos já
existem e são usados pelo `ConfirmDialog`). Não muda nenhuma tela sozinho —
entra com testes unitários próprios.

**Adaptação a 1266px:** o mockup mostra o painel de 440px como coluna ao lado
da lista. Em 1058px de conteúdo isso deixaria 618px para a tabela, menos que os
~698px que ela precisa — o mesmo cálculo que já empurrou o breakpoint de Saídas
para 1400px. Abaixo de 1400px o painel é **overlay** sobre a lista; acima, pode
ser coluna.

### F3 — Saídas: a lista assume a tela

Resolve os pontos 08, 09 e 11. Branch `feat/refactor-saidas`.

**O problema:** `DespesaForm.tsx` tem 698 linhas — o maior arquivo do renderer —
e fica fixo na tela de consulta. Dois `SegmentedControl` empilhados (tipo +
forma) somam oito botões antes do primeiro campo, e mudam quais campos existem;
nunca se vê o formulário inteiro.

**Renderer:**

- Form sai do layout permanente e vai para o `SidePanel`, aberto por "+ Nova
  saída". A lista ocupa a largura toda.
- Forma de pagamento vira quatro cartões em vez de segmented; valor em 24px por
  ser o campo que de fato se digita; parcelas ao lado dele.
- Agrupamento por dia com subtotal à direita, e total do período no topo.
- Chips de filtro com contagem (Tudo / Em fatura / Fora do cartão / Parceladas
  / Assinaturas).
- Bloco "Vai cair em" antes de salvar, mostrando em qual fatura o lançamento
  entra. Usa `calcular-fatura-da-compra`, que já existe — sem domínio novo.

**Fora do escopo da F3:** a coluna de impacto mensal (ponto 10) fica para a F4,
porque exige cálculo novo e mudança de contrato IPC. Até lá a coluna de valor
segue como está.

---

## 5. Fases seguintes — a detalhar após o lote 1

| Fase | Escopo                                                         | Pontos     | Custo         |
| ---- | -------------------------------------------------------------- | ---------- | ------------- |
| F4   | Impacto mensal: parcela do mês vs. valor da compra             | 10         | domínio + IPC |
| F5   | Faturas: trilho de cartões, funde lista + overview + detalhe   | 12, 13, 14 | alto          |
| F6   | Rendas: barra recebido/previsto, ponto colorido, média 6 meses | 15         | médio         |
| F7   | Cartões e Categorias: padrão único, sparkline, arquivar no ⋯   | 13, 14, 16 | médio         |
| F8   | Sistema: 6 degraus de tipo, largura única, 3 densidades        | 17         | alto          |
| F9   | Ajustes/Importar: herdam; "Restaurar backup" ganha confirmação | —          | baixo         |

Notas de risco já levantadas:

- **F4 deixa de ser refactor visual.** Cálculo novo no domínio (TDD obrigatório)
  e mudança do contrato tipado em `src/shared/`.
- **F5 é a de maior risco funcional.** Fundir `FaturasPage`, `FaturasOverview` e
  `FaturaDetalhe` mexe no deep-link (`buildFaturasSearch` / `parseFaturasSearch`)
  coberto por `e2e/deep-link-faturas.spec.ts`.
- **F8 colapsa três tiers de `PageContainer` em um.** `--page-max-narrow`,
  `--page-max` e `--page-max-wide` viram uma largura só. Isso invalida
  `e2e/alinhamento-paginas.spec.ts`, que é justamente o guard que trava o
  alinhamento entre rotas. A largura de 1560px da proposta precisa ser
  reavaliada contra os 1266px reais. Por isso vai por último — quando os
  layouts pararem de mudar.

---

## 6. Gates por fase

Regra 6 do `CLAUDE.md`: não há CI hospedada desde ago/2026. O pipeline local
precisa estar verde antes de abrir o PR, e verificar é responsabilidade de quem
abre.

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build && npm run e2e
```

Toda fase deste plano é visível na UI, então o `e2e` **sempre** entra. Antes de
release, `npm run smoke:visual` — 35 telas em 3 larguras. Não é regressão com
baseline; é folha de contato para revisão, e foi ela que pegou uma regressão de
alinhamento que os testes não viam.

Specs E2E são atualizadas **dentro da fase que as quebra**, não acumuladas para
o fim. São 27 arquivos de spec e 87 arquivos de teste unitário hoje.

Fluxo por fase: branch a partir da `main` atualizada → TDD no domínio quando
houver → implementação → gates → PR citando os pontos do diagnóstico cobertos →
merge na `main` antes de iniciar a próxima.

---

## 7. O que a proposta não muda

- Paleta Cream, tokens de cor, raios e sombras
- Geist / Geist Mono como famílias
- Qualquer regra de negócio do PRD — RN-01 a RN-08 ficam intactas
- O schema do banco: nenhuma fase do lote 1 exige migration
- Ajustes e Importar, que são telas de passo único já resolvidas
