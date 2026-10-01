# Plano — Tela de Faturas (set/2026)

> **Aprovado em 30/09/2026.** F1 e F2 mergeadas (#156, #157). F3 implementada na branch `feat/faturas-estrutura`; F4 pendente.

Origem: análise de 29/09/2026, pedida logo depois da v1.18.0 ("analise as melhorias
feitas na tela de Saídas e proponha as melhorias na tela de Faturas"). Mesmo fluxo do
redesenho de Saídas: análise, requisitos, plano e implementação, com aprovação entre as
etapas.

---

## 1. A tese

Faturas está onde Saídas estava antes da v1.18.0: a tabela não tem hierarquia, a mesma
parcela tem nome diferente nas duas telas e a página tem três bordas direitas. E tem
defeitos próprios, mais sérios que os de Saídas: a regra que escolhe a fatura do card
falha justamente no cartão que vence no mês seguinte ao fechamento, e a tela oferece
ações que ela mesma poderia saber que vão falhar.

## 2. Decisões

Tomadas por Juliano em 30/09/2026 — todas as recomendadas.

| #   | Decisão                         | Escolha                                                                                              |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A   | Estrutura do detalhe            | **Faixa de resumo** abaixo do título; tabela em largura inteira; "Marcar como paga" vira diálogo     |
| B   | Categoria na tabela             | **Sim**, com bolinha e selo de arquivada                                                             |
| C   | Filtros de Saídas na fatura     | **Não.** Saídas com "Origem: Inter" já é a fatura. A busca por descrição ficou em aberto e está fora |
| D   | Fatura do card (RF-FAT-06)      | **A não paga de vencimento mais próximo**, inclusive vencida; sem nenhuma, a mais recente (ver §3)   |
| E   | Destino do adiantamento (RN-03) | **A fatura em tela**; e adiantar nunca atrasa                                                        |
| F   | "Vence em N dias"               | **Janela de 7 dias**, a mesma do "fecha em"; vale também na Visão mensal                             |
| G   | Cartão arquivado                | **Continua no trilho**, esmaecido e com selo, enquanto tiver fatura a pagar                          |

## 3. O que mudou desde a análise

Quatro achados do detalhamento. Nenhum muda uma decisão, mas três ajustam como ela vira
requisito.

1. **A regra D ganha uma janela de um mês para trás.** Como aprovada, ela escolheria a
   fatura não paga **mais antiga** do cartão. Isso casa com o uso diário, mas não com a
   importação de histórico (RF-IMP) nem com quem não marca faturas como pagas: o card
   mostraria uma fatura de meses atrás, "vencida há 200 dias", até alguém pagar uma por
   uma. Olhando só do mês anterior em diante, a regra cobre o que a motivou — a fatura
   de um cartão com vencimento menor que o fechamento vence no mês **seguinte** ao da
   referência, então no dia 01 ela é do mês anterior — e as dívidas mais antigas ficam
   no Histórico, contadas em "A pagar".
2. **Fatura passada pode estar Aberta.** A análise disse que o filtro "Abertas" do
   Histórico nunca teria itens. Forte demais: a fatura nasce sempre `Aberta` (inclusive
   num lançamento retroativo) e só fecha no boot, no timer de uma hora ou ao abrir a
   Visão mensal. Até lá Faturas a mostra Aberta, sem aviso de vencida, oferecendo
   "Fechar fatura" — enquanto a Visão mensal mostra a mesma fatura Fechada. Vira o
   **R3**. E as abas do Histórico passam a ser **"A pagar / Pagas"**, que somam "Todas"
   em qualquer estado.
3. **O aviso do adiantamento mente.** Diz "N parcela(s) adiantada(s)" com a quantidade
   **pedida**. O repositório move só as elegíveis e devolve quais moveu, e a tela ignora
   a resposta: pedir 5 com 2 elegíveis, ou pedir para uma fatura que não recebe nada,
   anuncia 5. Entra no **R12**.
4. **A ordem das fases mudou.** A análise punha a regra D na F2. Ela sobe para a F1: é o
   defeito de uso mais frequente — todo mês, do dia 01 até o pagamento, o card do Inter
   mostra a fatura errada —, e a próxima vez é **01/10/2026**.

## 4. Requisitos

Cada requisito cita o RF/RN que toca e diz como se prova. Regra de negócio começa por
teste vermelho (CLAUDE.md, regra 1).

### F1 — O trilho e quais faturas aparecem

**R1 — Fatura do card** (RF-FAT-06, decisão D). A fatura que o card mostra, e que o
painel abre sem clique, é:

1. entre as faturas **não pagas, com total maior que zero, do mês anterior em diante**,
   a de **vencimento mais próximo** — inclusive vencida (empate: a de mês anterior);
2. sem nenhuma, a **mais recente**.

Aceite: cartão com vencimento menor que o fechamento, no dia 01, continua na fatura que
vence naquele dia; fatura do mês paga com a próxima aberta mostra a próxima; fatura não
paga de dois meses atrás não toma o card; cartão com uma fatura antiga só continua
mostrando ela (hoje coberto por `faturas-overview` e `fatura-vencida`). O deep-link sem
`faturaId` e a queda de link quebrado usam a mesma regra.

**R2 — Cartão arquivado** (RF-CAR-02, decisão G).

- O trilho inclui o cartão arquivado enquanto ele tiver fatura não paga com valor,
  depois dos ativos, esmaecido e com o selo "Arquivado".
- Link para fatura de cartão arquivado — o da Visão mensal, por exemplo — abre essa
  fatura, com o cartão no trilho enquanto a tela estiver aberta. Some o aviso falso "A
  fatura desse link não existe mais".
- O painel funciona como o de um ativo: pagar, reabrir, editar, excluir.
- O vazio distingue "Nenhum cartão cadastrado" de "Nenhum cartão ativo".

**R3 — Faturas fecha as vencidas ao abrir** (RN-06). O carregamento da tela aplica o
fechamento automático, como a Visão mensal já faz. Aceite: lançamento retroativo seguido
de Faturas mostra a fatura Fechada, com "Marcar como paga".

**R4 — Avisos de prazo** (RF-FAT-06, decisão F).

- Novo: fatura Fechada a até 7 dias do vencimento diz "vence hoje", "vence amanhã" ou
  "vence em N dias".
- Tom: vencida em vermelho (`--expense`); vence ou fecha em N dias em âmbar
  (`--pending`); o resto neutro.
- Onde: trilho, painel e o card de faturas da Visão mensal, que já colore os outros
  dois avisos e ganha só o novo.

**R5 — Data do pagamento** (RF-FAT-04). Fatura paga mostra quando foi paga: "paga em
DD/MM" no trilho (no lugar de "vence"), "Paga em DD/MM/AAAA" no painel e na linha do
Histórico (no lugar do vencimento).

**R6 — Histórico** (RF-FAT-06).

- Abas "Todas N · A pagar N · Pagas N", com contagem; "A pagar" é tudo que não está
  pago. Saem "Abertas" e "Fechadas".
- Sai a meta "3" sem rótulo, que repetia a linha de baixo.
- Escolher uma aba abre a lista.
- Linha não paga e vencida mostra "vencida há N dias", em vermelho.

### F2 — O que a tela oferece e falha

**R7 — Excluir desabilitado quando a regra bloqueia** (RF-DES-09). O detalhe da fatura
traz, por despesa, se a exclusão está bloqueada e por quê — calculado no main com
`podeDeletarDespesa`, a mesma regra que barra hoje. Bloqueada, "Excluir" fica
desabilitado no menu, com o motivo no título: "tem parcela paga" ou "tem parcela em
fatura fechada ou paga". Aceite: numa fatura Fechada, e numa parcelada cuja primeira
parcela já fechou, o item está desabilitado e nenhum diálogo abre.

**R8 — Editar compra à vista em fatura fechada** (RF-DES-10). O modal de edição trava
Valor e Data da compra, com o motivo, quando a fatura da compra não está Aberta.
Descrição e categoria seguem editáveis. O texto da parcelada passa a dizer o que
acontece: "Mudar o valor recalcula as parcelas em faturas abertas; as demais ficam como
estão." A prop é opcional: Saídas não muda.

**R9 — Erros legíveis.** Ciclo da fatura, adiantamento e edição passam por
`mensagemErro`: sem o prefixo do Electron, sem JSON do zod.

**R10 — Marcar como paga em diálogo** (RF-FAT-04, decisão A). O botão abre um diálogo
com a fatura (cartão, mês e total) e a Data de pagamento, que começa em hoje.
"Confirmar pagamento" fica desabilitado sem data válida, e um erro fica no diálogo em
vez de fechá-lo. Substitui o formulário inline.

**R11 — Texto do "Fechar fatura?"** (RN-06). Passa a dizer o que o fechamento trava: o
adiantamento para ela, o valor das parcelas dela e a exclusão das despesas dela. No
PRD, a redação do RN-06 é esclarecida sem mudar a regra — hoje ela diz "não aceita novas
parcelas" e, na linha seguinte, que o cadastro retroativo é permitido.

**R12 — Adiantar** (RN-03, decisão E).

- O destino padrão é a fatura em tela. As opções são as faturas Abertas do cartão até
  o mês dela.
- No domínio: só se movem parcelas de faturas **posteriores** ao destino. Adiantar
  nunca atrasa uma parcela.
- O aviso conta o que foi movido: "2 parcelas adiantadas."; menos que o pedido diz
  quantas; nenhuma diz "Nenhuma parcela para adiantar para esta fatura."

**R13 — Limpeza.** `pluralizar` nos avisos; sai `particionarPorMes` (usado só pelo
próprio teste), o `@media` vazio e os comentários de layouts que não existem mais.

### F3 — Geometria e estrutura

**R14 — Uma borda direita.** Detalhe, navegação e Histórico ocupam a mesma largura em
1024, 1280 e 1760. Guard E2E novo, no espírito de `alinhamento-de-valores`: mede a borda
direita dos três blocos, com tolerância de 1px.

**R15 — Bolinha.** `BolinhaDeCor` no título, no trilho e no Histórico, centrada no texto
(hoje fica ~6px acima).

**R16 — Navegação junto do título.** `[←] ● Inter · Setembro de 2026 [→]`, com o mesmo
botão do `SeletorMes`. O nome acessível e a dica dizem o destino ("Fatura anterior:
agosto de 2026"); sem vizinha, a seta fica desabilitada. Continua andando só pelas
faturas que existem.

**R17 — Faixa de resumo** (RF-FAT-03, RF-FAT-06, decisão A).

- Abaixo do título e acima da tabela: status com o aviso de prazo (R4) ou a data do
  pagamento (R5), fechamento, vencimento, "Total da fatura" e a ação do ciclo (Fechar
  fatura, Marcar como paga ou Reabrir fatura).
- Saem o card lateral, o breakpoint de 1360px, a linha "Mês" (o título já diz) e o
  total da meta do painel, que fica com "36 lançamentos".
- Na janela padrão, total e ação ficam acima das parcelas. Em 1024 a faixa quebra em
  duas linhas, sem rolagem horizontal.
- Região com nome acessível "Resumo da fatura".

### F4 — A tabela

**R18 — Sem coluna Status.** Toda parcela de uma fatura tem o status dela, por
construção (RN-06 paga e reverte todas juntas; o repositório recusa pagar uma parcela
com fatura sozinha). A faixa diz o status uma vez.

**R19 — Vocabulário de Saídas** (RF-DES-14). A coluna Parcela usa `descreverOcorrencia`,
a mesma função de Saídas, calculada no main: "à vista" em tom de apoio, "mensal", "1/6",
e "de R$ X" na parcelada criada do zero. Sai o selo ASSINATURA, que repetia "mensal".

**R20 — Coluna Compra.** A data da compra, como em Saídas. Assinatura mostra "desde
MM/AAAA" em tom de apoio, no lugar do dia 01 que o app inventava (a data de referência).
Ordena pela data da compra.

**R21 — Coluna Categoria** (decisão B). Bolinha, nome e o selo "Arquivada"
(`RotuloCategoria`). As categorias já são carregadas para o modal: sem IPC novo.

**R22 — Hierarquia.** Densidade compacta; Categoria e Compra um tom abaixo; Valor em 600. Ordem das colunas igual à de Saídas agrupada por origem: Descrição, Categoria,
Compra, Parcela, Valor, ações.

**R23 — Ações discretas.** Em tom de apoio, subindo com o mouse ou o foco na linha. O
cabeçalho da coluna fica sem texto visível (`aria-label="Ações"`).

**R24 — Editar assinatura.** Abre o `EditarAssinaturaModal`, já compartilhado com
Saídas. Some o "Editar" desabilitado.

**R25 — Ordenação.** `useOrdenacao` e `comparadores`, os de Saídas e da Busca — duas
implementações fariam o mesmo clique se comportar diferente. Descrição, Compra e Valor;
abre por Compra crescente (a ordem do extrato). Parcela deixa de ser ordenável: "à
vista", "mensal" e "1/6" não têm ordem natural.

## 5. Fases

Uma PR por fase, mergeada antes da seguinte. Em cada uma: pipeline local verde (`lint`,
`typecheck`, `tsc -p tsconfig.e2e.json`, `test:coverage`, `build`), folha de contato
nos dois temas e o E2E **proposto** ao fim — roda só com o seu ok (regra 10).

### F1 — `fix/faturas-trilho` — R1 a R6

- **Testes antes:** `escolherFaturaCorrente` (os cinco aceites do R1), função pura nova
  que decide os cartões do trilho (R2), `rotuloVencimento` e o tom do aviso (R4),
  filtro e contagem do Histórico (R6), teste do handler `listarResumoPorCartao`
  fechando as vencidas (R3) e os primeiros testes de página de `FaturasPage` e
  `HistoricoFaturas`.
- **E2E:** spec novo `faturas-cartao-arquivado` (arquivar com fatura a pagar, o card
  continua; o link da Visão mensal abre a fatura certa; pagar tira o card).
  `excluir-despesa` perde o passo "Fechar fatura" na fatura retroativa (R3).
  `assinaturas` também muda com o R3, e ficou fora deste mapeamento — o E2E achou:
  ele cancelava uma assinatura retroativa esperando que ela sumisse de todos os
  meses, o que só acontecia porque as faturas passadas seguiam Abertas por atraso
  da manutenção. Passa a conferir o RF-DES-07 como escrito: a ocorrência em fatura
  fechada fica, com o selo "Cancelada"; a de fatura aberta some.
- **PRD:** RF-FAT-06 (regra, avisos, histórico, manutenção), RF-FAT-04 (data do
  pagamento), RF-CAR-02 (arquivado em Faturas).
- **Folha de contato:** semente com um cartão arquivado com fatura a pagar e uma fatura
  paga.

### F2 — `fix/faturas-acoes` — R7 a R13

- **Testes antes:** `selecionarParcelasParaAdiantar` só com parcelas posteriores ao
  destino (domínio, R12); método do repositório que diz o bloqueio de exclusão por
  despesa (R7); handler `detalharComParcelas` devolvendo o bloqueio; testes de página
  de `FaturaDetalhe` (Excluir desabilitado com motivo, aviso do adiantamento),
  `PagarFaturaModal` (data vazia) e `EditarDespesaModal` (trava de valor e data).
- **IPC:** campo opcional novo em `FaturaDetalhada`, tipado em `src/shared` (regra 5).
- **E2E:** `excluir-despesa` passa a esperar o Excluir **desabilitado** na fatura
  reaberta como Fechada (hoje espera habilitado e o erro depois). Spec novo
  `faturas-adiantar` — não existe nenhum hoje. `fatura-vencida` e `excluir-despesa`
  seguem clicando "Marcar como paga" e "Confirmar pagamento", agora no diálogo.
- **PRD:** RF-DES-09, RF-DES-10, RF-FAT-04, RN-03, RN-06 (redação).
- **Folha de contato:** captura nova do diálogo de pagamento.

### F3 — `feat/faturas-estrutura` — R14 a R17

- **Testes antes:** página de `FaturaDetalhe` (faixa com total e ação, sem a linha Mês,
  navegação com o nome do destino).
- **E2E:** guard novo de borda direita (R14). `excluir-despesa` escopa o status pela
  região "Resumo da fatura" (hoje pelo rótulo "Status"). `deep-link-faturas`,
  `excluir-despesa` e `importar-csv` clicavam no texto da linha "Mês" para confirmar a
  fatura aberta; passam a conferir o título. `faturas-acoes-visiveis` continua como
  guard, com os comentários sobre o aside revistos. `despesas` segue ancorado em "Total
  da fatura", que a faixa mantém.
- **PRD:** RF-FAT-03 e RF-FAT-06 (faixa e navegação).

### F4 — `feat/faturas-tabela` — R18 a R25

- **Testes antes:** handler `detalharComParcelas` devolvendo a descrição da ocorrência
  por parcela (R19); página de `FaturaDetalhe` (colunas, "à vista", "desde", categoria
  arquivada, editar assinatura, ordenação).
- **IPC:** segundo campo opcional em `FaturaDetalhada`, com a ocorrência de cada
  parcela.
- **E2E:** "1/1" vira "à vista" em quatro specs (sete usos: `deep-link-faturas`,
  `despesas`, `excluir-despesa`, `faturas-overview`).
- **Arquivos removidos (pedem confirmação):**
  `src/renderer/features/faturas/data-parcela.ts` e
  `src/renderer/features/faturas/__tests__/data-parcela.test.ts`, que ficam sem uso
  com a coluna Compra.
- **PRD:** RF-FAT-03 (colunas e vocabulário).

### Release

Depois da F4: v1.19.0 (`npm version minor`), CHANGELOG e README numa PR de docs, e a
publicação só com confirmação (CLAUDE.md §7.5), com o `latest.yml`.

## 6. Fora do ciclo, anotado

- **Saídas tem dois dos mesmos defeitos:** Excluir oferecido onde a regra bloqueia, e
  o modal permitindo mudar valor e data de compra à vista em fatura fechada. A
  ocorrência não traz o status da fatura, então a correção pede dado novo no IPC de
  Saídas. A correção das mensagens de erro (R9) já vale lá, porque o modal é
  compartilhado.
- Busca por descrição dentro da fatura (decisão C).
- Card do trilho sinalizar "+N faturas atrasadas" além da janela do R1.
- Herdados: ranking da Visão mensal sem o selo de categoria arquivada; axe moderado na
  Visão mensal; `electron/main.ts` sem teste.
