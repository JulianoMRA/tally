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

Em 19/08/2026, ao abrir a F8:

| Decisão       | Escolha                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Largura única | **1560px**, o valor da proposta. Em 1266 as opções empatam; é a única que não estreita as telas densas em monitor grande |
| Escopo da F9  | **Rederivado da captura** — a confirmação de "Restaurar backup" que o plano previa já existia                            |

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

### 3.3 Guards de CSS bloqueiam valor solto

`src/renderer/styles/__tests__/` tem um guard que falha se aparecer hex
hardcoded no CSS de uma feature, e outro que falha se um `var(--x)` sem fallback
não existir em `tokens.css`. As cores novas da proposta — a barra de composição
(`#7fb389`, `#c98a7c`, `#d9b06a`) e a marca de limite do ranking — precisam
virar token antes de serem usadas.

A F8 acrescentou um terceiro, `tipo-tokenizado`, na mesma forma: nenhum
`font-size` em px fora de `tokens.css`, e a escala com exatamente seis degraus.

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

## 6. F6 — Rendas — CONCLUÍDA

Resolve o ponto 15. Branch `feat/refactor-rendas`.

**O problema, confirmado no código:** três cards de peso igual (Esperado /
Recebido / Total do mês) que não se liam como soma, e cada linha com duas
colunas de data — "esperada 05/08/2026" e "Recebido 05/08/2026" — dizendo quase
a mesma coisa.

**Entregue:** `descreverRecebimento` funde as duas colunas numa frase;
`montarProgressoDoMes` alimenta a barra e a nota de pendências;
`mediaDeEntradas` traz a referência histórica. 18 testes. O cadastro de avulso
virou `SidePanel` — primeira consumidora do componente fora de Saídas.
Especificado em RF-REN-07 e RF-REN-08.

**Decisões que foram além do mockup:**

- **Atraso ganhou frase própria.** O mockup previa só "na conta em 05/08" e
  "previsto para 25/08 · em 10 dias". Um previsto cuja data já passou cairia em
  "em -5 dias"; agora diz `atrasado 5 dias`, destacado. É o caso que pede ação.
- **O anel do ponto é sólido, não tracejado.** Num círculo de 10px o traço de
  2px rende três segmentos e lê como artefato. O que carrega a informação é
  cheio vs. vazado.
- **A média exclui o mês corrente e some quando é zero.** Incluir o mês em curso
  puxaria a média para baixo todo mês; e "média R$ 0,00" numa base sem histórico
  faria qualquer mês parecer excepcional.
- **`EditarRendaModal` e `MarcarRecebidoModal` continuam modais.** O `SidePanel`
  é para cadastro sob demanda; confirmação de dois campos não ganha nada
  virando painel.

---

## 7. F7 — Cartões e Categorias — CONCLUÍDA

Resolve os pontos 13, 14 e 16. Branch `feat/refactor-cartoes-categorias`.

**O problema, confirmado no código:** duas telas espelhadas em que um formulário
vazio ocupava 380px em toda visita, e a linha do cartão trazia nome, dias e um
badge "Ativo" que nunca é falso na visão padrão — cadastro morto. Arquivar
dividia a linha com Editar, no mesmo peso, e sem confirmação.

**Entregue:** `resumirCartao` (função pura, 14 testes) apura a fatura aberta do
mês corrente, a série dos até seis meses encerrados e a média do período;
`alturasDaSparkline` escala as barras. As duas telas passaram ao padrão de
Saídas — lista em largura cheia e cadastro em `SidePanel` sob demanda. Arquivar
saiu para o menu ⋯ com `ConfirmDialog`, e arquivados descem esmaecidos para o
fim em vez de dependerem de troca de estado. Especificado em RF-CAR-04;
RF-CAR-02 e RF-CAT-02 ganharam a confirmação e a ordenação.

**Decisões que foram além do plano, as três últimas achadas pela captura:**

- **A sparkline olha só o passado encerrado.** Incluir o mês corrente misturaria
  uma fatura em formação com meses fechados, e a última barra ficaria sempre
  menor — o cartão pareceria em queda todo dia 2.
- **A média some quando o histórico soma zero**, pelo mesmo motivo da F6.
- **"últimos N meses" saiu do rótulo.** A sparkline já mostra quantos meses são;
  repetir isso no texto estourava a coluna e truncava justamente o número da
  média, que é a informação.
- **A última barra usa a cor do cartão**, as anteriores ficam neutras: sem isso
  é preciso contar barras para achar o mês mais recente.
- **A proporção da sparkline é o que a faz ler como tendência.** Nasceu com
  22px de altura e barras de 34px: a diferença entre 63% e 100% rendia sete
  pixels e a série virava fileira de blocos. 30px de altura, 12px de largura
  máxima por barra.
- **O formulário entra no painel sem card próprio.** Os dois levaram junto
  borda, sombra, padding e um `<h2>` repetindo o título do `SidePanel` — o
  mesmo defeito que a F3 já corrigira em Saídas, reintroduzido por cópia.

**Custo em teste:** o formulário atrás do painel invalidou o preâmbulo de seed
que **dezenove specs** repetiam — seis linhas para criar um cartão e uma
categoria. Em vez de corrigir cada cópia, o par `criarCartao` / `criarCategoria`
entrou em `e2e/fixtures/navegacao.ts`, no mesmo movimento que
`abrirCadastroDeSaida` fez na F3: 241 linhas saíram das specs. Os dois specs de
CRUD foram reescritos à mão, porque neles o fluxo alterado **é** o objeto do
teste.

---

## 8. F9 — Ajustes e Importar — CONCLUÍDA

Branch `feat/refactor-ajustes-importar`. Executada antes da F8, que precisa ser
a última.

**A premissa desta fase estava errada.** O plano dizia "Restaurar backup ganha
confirmação"; ela já existia — `AjustesPage` monta um `ConfirmDialog` com
`confirmVariant="danger"`, e o corpo já explica que uma cópia do estado atual é
feita antes. Não havia ação destrutiva sem confirmação nas duas telas: importar
é aditivo e atômico. O escopo foi rederivado da captura.

**O que as telas tinham, de fato:**

- **O `EmptyState` cheio dentro de um painel.** Ele existe para lista vazia que
  ocupa a tela, onde os 48px de respiro impedem a página de parecer quebrada.
  Dentro de um painel que é só uma parte da tela, dizer "ainda não há nada aqui"
  custava ~250px de altura — em Ajustes **e** em Importar. Nova prop `compacto`.
- **"Salvar ajustes" abaixo da dobra.** O botão confirma TODAS as seções, mas em
  1266px ficava fora da vista: quem mexia em "Avisos de fatura" não via que
  ainda precisava salvar, e a tela não tinha como avisar que havia pendência.
  Virou barra fixa no rodapé, com o aviso "Alterações não salvas".
- **"Restaurar" era botão solto na linha.** É a única ação da cópia, mas
  substitui a base inteira. Pelo padrão da F7 foi para o `RowActions` marcada
  como destrutiva — que é exatamente o caso previsto no componente: ação
  destrutiva não vira botão solto nem quando é a única.

**Token novo:** `--shadow-up`. Sem sombra para cima, o conteúdo passando por
baixo da barra fixa fazia o painel parecer **cortado**, não coberto.

**O que ficou de fora de propósito:** largura. `width="narrow"` e os três tiers
de `PageContainer` são território da F8, travados por
`e2e/alinhamento-paginas.spec.ts`.

---

## 9. F8 — Sistema — CONCLUÍDA

Resolve o ponto 17. Branch `feat/refactor-sistema`. Última do plano, como
previsto: só dá para fixar o sistema quando os layouts param de mudar.

**A medição mudou a premissa da fase.** Na janela real do app dois dos três
tiers já eram a mesma coisa: com 1266px de viewport a área de conteúdo é 1058px,
então `default` (1200) e `wide` (1760) clipam no mesmo lugar. Só o `narrow`
(760) se distinguia — e era ele que deixava Ajustes e Importar com ~330px de
espaço morto. Um tier que só existe acima de 1230px de viewport não é
hierarquia, é inconsistência entre telas.

**Largura única: 1560px** (decisão de Juliano, 19/08/2026). Em 1266 as três
opções davam o mesmo resultado para 6 das 8 telas; a diferença só aparece em
monitor grande, e 1560 é o único valor que não estreita as telas mais densas.
O `PageContainer` perdeu a prop `width` e o par trilho/bloco — este existia só
para impedir que tiers diferentes desalinhassem as rotas, e some junto com eles.
Formulário de configuração não estica: quem limita é `--form-max` na linha do
campo, não a página.

**Seis degraus de tipo.** Eram **onze** tamanhos em 189 declarações — 10, 11,
12, 13, 14, 15, 16, 18, 20, 22, 26 —, nenhum tokenizado. Doze e onze pixels lado
a lado não se distinguem; treze e quatorze, menos ainda. Não era escala, era
gradiente, e é essa a mecânica do "tudo tem o mesmo peso" da tese. Mapeamento:
11→2, 14→4, 16→4, 20→5, 26→6. O número do hero segue fluido (`clamp`) porque
escala com a janela e não pertence a degrau nenhum.

**Três densidades.** Já existiam de fato — 8px em cabeçalho de tabela, 10px em
célula, 12px em linha de lista —, só não tinham nome. O único fora do padrão era
o ranking, com 9px: um degrau que existia porque ninguém tinha nomeado os
outros.

**Guard novo, `tipo-tokenizado`**, na forma do de cores: nenhum `font-size` em
px fora de `tokens.css`, e a escala tem exatamente seis degraus. Densidade
**não** ganha guard, e isso é decisão: `padding` serve a muito mais que altura
de linha, e proibir px em padding proibiria o legítimo junto com o acidental.

**Dois defeitos que a fase encontrou, e um que ela não causou:**

- **A coluna de uso do ranking era 84px fixos**, medidos para o 11px de antes.
  Em 12px "133% do limite" vazava para fora do painel. Virou `auto`: numa grade
  a largura é a mesma em todas as linhas, então o texto define a medida sem
  número mágico.
- **O detalhe da fatura virava duas colunas em 1200px**, e o aside de 340px
  derrubava a tabela para 629px — **alargar a janela deixava a tabela mais
  estreita**. A folga era de poucos pixels e a escala de tipo a consumiu;
  `faturas-acoes-visiveis` denunciou. Subiu para 1360px, que é onde as duas
  colunas de fato cabem. De quebra some o defeito **pré-existente** (conferido
  contra a `main`) de a descrição quebrar em três linhas. A ordem do DOM passou
  a `header → main → aside`, que é a ordem visual dos dois layouts: empilhado,
  o que se veio ver são as parcelas, não o resumo.

---

## 10. Gates por fase

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

## 11. O que a proposta não muda

- Paleta Cream, tokens de cor, raios e sombras
- Geist / Geist Mono como famílias
- Qualquer regra de negócio do PRD — RN-01 a RN-08 ficam intactas. O lote 1
  acrescentou requisitos funcionais (RF-VIS-07, RF-DES-14, RF-DES-15) e
  reescreveu outros (RF-VIS-02, RF-VIS-06, RF-ORC-02), mas nenhuma RN mudou
- O schema do banco: nenhuma fase do lote 1 exige migration
- Ajustes e Importar, que são telas de passo único já resolvidas
