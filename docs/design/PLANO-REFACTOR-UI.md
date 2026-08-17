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

## 2. Decisões tomadas

Tomadas por Juliano em 16/08/2026:

| Decisão            | Escolha                                                  |
| ------------------ | -------------------------------------------------------- |
| Largura alvo       | Adaptar para **1266px**. Sem mexer no `BrowserWindow`.   |
| Escopo do lote     | **F1–F3**, depois reavaliar                              |
| Aba Análise        | Confirmada. Pizza sai. Orçamento vira marca no ranking.  |
| Arquivos de design | Commitados em `docs/design/referencia/proposta-2026-08/` |

Em 17/08/2026, já com a F3 em andamento:

| Decisão         | Escolha                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| Ordem           | **F4 antes de terminar a F3** — o total da F3 nascia errado sem ela      |
| Lista de Saídas | **Recortada por mês, uma linha por ocorrência**, abrindo no mês corrente |
| Specs E2E       | Ajustar os specs ao recorte, em vez de abrir no mês do último lançamento |

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

## 4. Lote 1 — F1 a F4 — CONCLUÍDO

O lote foi combinado como F1–F3, mas a F4 entrou junto: sem ela o total que a
F3 introduziu ficava errado. Ver a nota de inversão na F4.

Estado em 17/08/2026: F1 mergeada na `main` (PRs #90 e #91); F2, F3 e F4 na
branch `feat/refactor-saidas`, aguardando PR.

### F1 — Visão mensal: hero, agenda e aba Análise — CONCLUÍDA

Resolve os pontos 01–07. Branch `feat/refactor-visao-mensal`, mergeada.

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

### F2 — `SidePanel` — CONCLUÍDA

Pré-requisito de F3, F6 e F7. Entregue na branch `feat/refactor-saidas` junto
com a F3: o componente sozinho não tem consumidor, e um PR só dele não teria
como ser revisado em funcionamento.

Painel lateral sobreposto, com `useFocusTrap` e `useEscapeKey` (o mesmo par do
`ConfirmDialog`). Sem prop `aberto` — quem monta é o pai, o que garante
formulário limpo a cada abertura. Cabeçalho e rodapé fixos, só o corpo rola.
`fecharNoOverlay={false}` para formulário com dado digitado.

**Desvio do plano: é sempre overlay, nunca coluna.** O plano previa "coluna
acima de 1400px, overlay abaixo". Implementar os dois modos empurraria a decisão
de layout para dentro do componente e inflaria um PR que era para ser pequeno.
O drawer resolve as duas faixas; se a coluna voltar a fazer sentido, é layout de
página, não do componente.

### F3 — Saídas: a lista assume a tela — CONCLUÍDA

Resolve os pontos 08, 09 e 11. Branch `feat/refactor-saidas`.

**O problema:** `DespesaForm.tsx` tem 698 linhas — o maior arquivo do renderer —
e ficava fixo na tela de consulta. Dois `SegmentedControl` empilhados (tipo +
forma) somavam oito botões antes do primeiro campo.

**Entregue:**

- Form saiu do layout permanente e foi para o `SidePanel`, aberto por "+ Nova
  saída". A lista ocupa a largura toda, e o breakpoint de 1400px foi eliminado
  — ele existia só para decidir se o form cabia ao lado da tabela.
- Fecha ao salvar, **não** fecha ao errar (quem errou precisa do que digitou) e
  não fecha por clique no overlay.
- Duplicar abre o painel preenchido, em vez de rolar a página até o topo.
- Forma de pagamento em cartões 2×2, via variante `cartoes` no
  `SegmentedControl` — só CSS: papéis, nomes acessíveis e teclado idênticos, o
  que evitou churn em todos os `getByRole('radio')` da suíte.
- Valor em 22px nos cinco formulários; parcelas ao lado dele.
- Chips de filtro com contagem do mês.
- Prévia "Vai cair em" (RF-DES-15), aplicando RN-01 na digitação.

**Desvio: a tabela ficou tabela.** A proposta desenha uma lista de linhas, mas
15 specs dependem de `getByRole('cell')`. Os cabeçalhos de grupo entraram como
`<tr>` na mesma tabela — entrega o ritmo e o subtotal sem invalidar a suíte nem
desalinhar a coluna de valor entre grupos.

**Custo que o plano não previu:** 15 specs E2E precisaram abrir o painel antes
de preencher o formulário. Resolvido com o helper `abrirCadastroDeSaida` em
`e2e/fixtures/navegacao.ts`.

### F4 — Impacto mensal — CONCLUÍDA (executada antes do fim da F3)

Resolve o ponto 10. Mesma branch.

**Inversão de ordem, e por quê.** A F3 introduziu um "total do período" que
somava o preço cheio de um parcelado com uma mensalidade e um gasto à vista —
herdando exatamente o ponto 10. O número ficava errado até a F4 entrar, então a
F4 foi executada antes de terminar a F3.

**Mudança de escopo em relação ao plano.** O plano descrevia "adicionar uma
coluna". A investigação mostrou que isso não bastava:

1. A lista não tinha recorte de mês — `listarDespesas()` devolvia todas as
   despesas já cadastradas. "Total do período" não era período nenhum.
2. Em parcelada em andamento, `despesa.valor_centavos` é o valor **restante** e
   `total_parcelas` é o total cheio; dividir um pelo outro dá errado.
3. O mockup da proposta já resolvia os dois: seletor de mês no cabeçalho e uma
   linha por ocorrência, não por despesa.

Decidido com o Juliano em 17/08: **escopar ao mês, uma linha por ocorrência**,
abrindo no mês corrente. Especificado em RF-DES-14.

**Entregue:** domínio `descrever-ocorrencia.ts` (TDD, 18 testes), consulta
`listarOcorrenciasDoMes` (9 testes de integração), contrato `OcorrenciaDoMes`
em `src/shared`, handler, preload, e o renderer com seletor de mês, agrupamento
por origem e as duas colunas de dinheiro.

**Desvio: agrupamento por origem, não por dia.** O mockup agrupa por dia, e a
F3 chegou a entregar isso. Mas quando a linha vira ocorrência, a parcela 7/12 de
uma compra de sete meses atrás não aconteceu em dia nenhum do mês exibido — ela
pertence a uma fatura. Agrupar por cartão também faz o subtotal reconciliar com
o total da fatura em RF-FAT. O `agruparPorDia` da F3 foi descartado.

**Bug pré-existente que a F4 expôs:** `criarUnicaCredito` grava
`parcela.data_referencia` com a data da compra, enquanto as parceladas gravam o
mês da fatura. A consulta contorna usando a fatura como fonte de verdade
(`COALESCE`), com teste cobrindo; a inconsistência de origem continua no banco e
precisa de migration para ser corrigida.

---

## 5. F5 — Faturas — CONCLUÍDA

Resolve os pontos 12, 13 e 14. Branch `feat/refactor-faturas`.

**O problema:** três cliques até a fatura atual — select de cartão, lista
agrupada por cartão (que repetia o select), item. 1.283 linhas em três
componentes.

**Entregue:** `escolherFaturaCorrente` (regra pura, 11 testes) decide o padrão
que faz os zero cliques valerem; `TrilhoCartoes` substitui select e
agrupamento; `HistoricoFaturas` colapsa o passado com filtro por status;
`FaturasPage` funde tudo e preserva o deep-link. Especificado em RF-FAT-06.

`FaturaDetalhe` foi preservado inteiro de propósito — só perdeu o `onVoltar`.
Refatorar layout e ciclo de vida da fatura no mesmo commit confundiria a causa
de qualquer regressão.

**Desvios e decisões:**

- **Faturas futuras saíram da lista** e viraram navegação de mês. A F5 chegou a
  listá-las, e a captura mostrou onze faturas idênticas de R$ 400 — uma por
  parcela de um 12x. Era o ponto 13 reaparecendo dentro da própria correção.
- **Link morto abre a fatura corrente e avisa**, em vez do estado vazio com
  "Voltar". Com lista e detalhe fundidos não há mais para onde voltar.
- **O trilho não acompanha o mês do painel** — mostra a situação de hoje.
- **O filtro por status voltou com escopo novo.** Ele vivia na `FaturasOverview`
  varrendo todos os cartões; ao absorver a tela eu o perdi por omissão, e o
  spec da fase 8 é que denunciou. Voltou dentro do histórico, agindo sobre o
  cartão em foco — o recorte que a tela nova tem.

**Bug que os specs acharam:** clicar num cartão já em foco zerava o `faturaId`,
mas o efeito de resolução não re-rodava porque `grupoEmFoco` não mudava de
identidade — o trilho exibia a fatura enquanto o painel dizia "Nenhuma fatura
neste cartão". Corrigido com a condição `precisaResolver` nas dependências.

**Custo em teste:** 15 dos 86 specs quebraram. Nove eram mecânicos (o caminho de
navegação), seis conceituais. `faturas-overview.spec.ts` não foi apagado —
virou a cobertura de "chegar à fatura sem escolher nada", que é a prova do ponto 12.

---

## 6. Fases seguintes — a detalhar

| Fase | Escopo                                                         | Pontos     | Custo |
| ---- | -------------------------------------------------------------- | ---------- | ----- |
| F6   | Rendas: barra recebido/previsto, ponto colorido, média 6 meses | 15         | médio |
| F7   | Cartões e Categorias: padrão único, sparkline, arquivar no ⋯   | 13, 14, 16 | médio |
| F8   | Sistema: 6 degraus de tipo, largura única, 3 densidades        | 17         | alto  |
| F9   | Ajustes/Importar: herdam; "Restaurar backup" ganha confirmação | —          | baixo |

Notas de risco já levantadas:

- **F8 colapsa três tiers de `PageContainer` em um.** `--page-max-narrow`,
  `--page-max` e `--page-max-wide` viram uma largura só. Isso invalida
  `e2e/alinhamento-paginas.spec.ts`, que é justamente o guard que trava o
  alinhamento entre rotas. A largura de 1560px da proposta precisa ser
  reavaliada contra os 1266px reais. Por isso vai por último — quando os
  layouts pararem de mudar.

---

## 7. Gates por fase

Regra 6 do `CLAUDE.md`: não há CI hospedada desde ago/2026. O pipeline local
precisa estar verde antes de abrir o PR, e verificar é responsabilidade de quem
abre.

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build && npm run e2e
```

Toda fase deste plano é visível na UI, então o `e2e` **sempre** entra. E o
`npm run smoke:visual` deixou de ser só ritual de release: no lote 1 ele pegou
três defeitos que teste nenhum via — a escala do ranking achatada por um limite
grande, a barra de progresso cheia em gasto à vista, e o formulário virando
caixa dentro de caixa ao entrar no painel. Rodar a folha de contato **dentro da
fase**, não só antes de publicar.

Specs E2E são atualizadas **dentro da fase que as quebra**, não acumuladas para
o fim. O lote 1 mexeu em 20 dos 27 arquivos de spec; a maior parte por causa de
duas mudanças estruturais — o formulário virando painel e a lista ganhando
recorte de mês.

Fluxo por fase: branch a partir da `main` atualizada → TDD no domínio quando
houver → implementação → gates → PR citando os pontos do diagnóstico cobertos →
merge na `main` antes de iniciar a próxima.

---

## 8. O que a proposta não muda

- Paleta Cream, tokens de cor, raios e sombras
- Geist / Geist Mono como famílias
- Qualquer regra de negócio do PRD — RN-01 a RN-08 ficam intactas. O lote 1
  acrescentou requisitos funcionais (RF-VIS-07, RF-DES-14, RF-DES-15) e
  reescreveu outros (RF-VIS-02, RF-VIS-06, RF-ORC-02), mas nenhuma RN mudou
- O schema do banco: nenhuma fase do lote 1 exige migration
- Ajustes e Importar, que são telas de passo único já resolvidas
