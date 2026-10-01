# Plano — Pagamento parcial de fatura (out/2026)

> **Aprovado em 01/10/2026**, com as decisões A e B e os padrões C a H como estão. F1
> mergeada (PR #161). F2 implementada na branch `feat/pagamento-parcial-faturas`. F3 por
> fazer: até ela, a Visão mensal ainda conta a fatura pelo total.

Origem: pedido de 01/10/2026, logo depois da v1.19.0. Durante o mês são feitos pagamentos
parciais das faturas em aberto, para reduzir o valor final, e o app só sabe adiantar
parcela e pagar a fatura inteira. O improviso em uso é lançar o parcial como renda avulsa:
a sobra do mês fica certa e o valor da fatura fica errado. Fluxo combinado: estudo,
requisitos, plano, implementação com teste e release.

---

## 1. A tese

O app não tem o conceito de "quanto foi pago". Pagar é um status (`Fechada → Paga`) com uma
data, que marca todas as parcelas da fatura como pagas (RN-06). O total nunca é gravado: é
sempre a soma das parcelas (RN-07), calculada na leitura em três pontos.

| Onde o total nasce                             | O que ele alimenta                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `FaturaRepository.listarResumoPorCartao`       | trilho de cartões, histórico, tela de Cartões                                            |
| handler `detalharComParcelas`                  | painel da fatura, diálogo "Marcar como paga"                                             |
| `VisaoMensalRepository.detalharSomenteLeitura` | sobra projetada (RN-08), card de faturas, agenda, PDF, CSV, evolução do saldo, Simulação |

Uma renda avulsa de R$ X soma X nas entradas, o que na RN-08 é aritmeticamente igual a
tirar X da fatura. Por isso o improviso acerta a conta e erra a tela: a fatura continua
mostrando o total em todos os lugares da tabela acima.

A feature dá ao pagamento parcial um registro próprio, ligado à fatura, e faz os três
pontos de leitura descontarem esse registro pela mesma função.

## 2. Decisões

Tomadas por Juliano em 01/10/2026.

| #   | Decisão                              | Escolha                                                                                                                               |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Como o parcial entra na sobra do mês | **Abatimento.** A fatura passa a valer total menos parciais para tudo, inclusive na RN-08. É o número do improviso, sem a renda falsa |
| B   | Escopo desta versão                  | **Só o essencial**: registrar e excluir. Erro de digitação se corrige excluindo e registrando de novo                                 |

Padrões assumidos, apresentados em 01/10/2026 e aprovados junto com o plano.

| #   | Padrão                     | Escolha                                                                                                                                           |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| C   | Quais faturas aceitam      | `Aberta` e `Fechada`. `Paga` não: reabrir antes                                                                                                   |
| D   | Teto do valor              | Não passa do que falta pagar. Em fatura `Fechada`, o valor que quita o restante é "Marcar como paga", não pagamento parcial                       |
| E   | Status                     | Pagamento parcial nunca muda o status da fatura nem das parcelas, e não trava edição nem exclusão de despesa                                      |
| F   | Onde se registra           | Só na tela de Faturas, com valor e data (padrão hoje). Sem descrição                                                                              |
| G   | O número da fatura na tela | Com parcial, o número principal é o que falta pagar, com o total como contexto. Gasto por categoria, Saídas e Cartões seguem pelo valor da compra |
| H   | O improviso que já existe  | Sem conversão automática. Nas faturas ainda não pagas, a renda avulsa do improviso é apagada à mão e o parcial é registrado na fatura             |

**O que a decisão A implica, para ficar escrito.** Os R$ 200 de um parcial não contam como
saída em mês nenhum: a fatura de R$ 800 passa a pesar R$ 600 no mês dela, paga ou não. A
conta é fiel quando o dinheiro do parcial não veio de uma entrada já lançada naquele mês
(sobra anterior, ajuda não lançada). Se veio, a sobra fica acima do real pelo valor do
parcial. E a renda avulsa do improviso, se ficar junto com o parcial na mesma fatura, conta
o abatimento duas vezes — por isso o padrão H.

## 3. Vocabulário

| Termo                 | Significado                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Total da fatura**   | Soma das parcelas (RN-07). Não muda: é quanto foi comprado                                                                      |
| **Pagamento parcial** | Valor pago numa fatura antes da quitação, com data. Não é adiantamento de parcela (RN-03), que move parcelas entre faturas      |
| **Falta pagar**       | Total menos os pagamentos parciais, nunca negativo. É o valor da fatura para a tela e para a sobra do mês                       |
| **Pago a mais**       | O que os parciais passam do total. Só aparece se uma despesa for excluída ou reduzida depois do pagamento, numa fatura `Aberta` |

## 4. Requisitos

Cada requisito cita o RF/RN que toca e diz como se prova. Regra de negócio começa por teste
vermelho (CLAUDE.md, regra 1).

### F1 — Regra, dados e contrato

Sem mudança visível: o que entra aqui só passa a ter efeito quando a F2 permitir registrar.

**R1 — Valor a pagar** (RN-10, nova). `falta pagar = max(0, total − soma dos parciais)` e
`pago a mais = max(0, soma dos parciais − total)`. Uma função pura só, usada nos três
pontos de leitura da seção 1. Aceite: sem parcial, falta pagar é o total; 800 com 200 pagos
dá 600; parciais iguais ao total dão zero; acima do total, falta pagar zero e a diferença em
pago a mais; e, por propriedade (fast-check), `falta pagar − pago a mais = total − parciais`
com pelo menos um dos dois em zero.

**R2 — Quem aceita pagamento parcial** (RN-10, padrões C e D). Recusa, nesta ordem:

1. fatura `Paga` ("reabra a fatura antes");
2. valor que não seja inteiro de pelo menos 1 centavo;
3. data fora do calendário;
4. valor acima do que falta pagar;
5. em fatura `Fechada`, valor igual ao que falta pagar ("esse valor quita a fatura: use
   Marcar como paga").

A fatura vem antes do valor de propósito, como em `podeMarcarOcorrenciaPaga`: quando os
dois valem, a mensagem aponta o dono da decisão. Aceite: um caso por recusa, mais `Aberta`
aceitando o valor igual ao que falta (ela ainda não pode ser marcada como paga).

**R3 — Excluir pagamento parcial** (RN-10). Fatura `Paga` recusa, com a mesma saída de
RF-FAT-05 (reabrir). Nas outras, o registro some e o falta pagar volta. Aceite: os dois
casos.

**R4 — Modelo de dados.** Migration `0015_pagamento_parcial`, aditiva, dentro da transação
padrão do runner: tabela `pagamento_parcial` (`id`, `fatura_id` com FK `RESTRICT`,
`valor_centavos` com `CHECK > 0`, `data_pagamento` com `CHECK` de formato, `created_at`,
`updated_at`) e índice por fatura. Aceite: tabela e colunas; os `CHECK` recusam zero,
negativo e data malformada; a FK recusa fatura inexistente e impede apagar fatura com
pagamento; dados existentes intactos; rodar de novo não reaplica. Os três testes que
travam a contagem de migrations em 14 passam a 15.

**R5 — Repositório.** `PagamentoParcialRepository`, um arquivo, com `registrar`, `excluir`,
`listarPorFatura` (por data, depois por id) e a soma por fatura. A elegibilidade vive no
domain (R2, R3); aqui fica a escrita, em transação. Aceite: integração em SQLite em
memória para cada método e cada recusa, com a mensagem que a tela vai mostrar.

**R6 — Exportar e importar dados** (RF-APP-04). O JSON ganha `pagamento_parcial`, com
`default([])` para o export antigo continuar importável. Na importação a tabela é apagada
antes de `fatura` e inserida depois dela. Aceite: ida e volta preserva os pagamentos;
export sem a chave importa; importar sobre uma base que já tem pagamento não quebra por FK;
pagamento apontando para fatura inexistente reverte a importação inteira.

**R7 — Contrato IPC** (regra 5). Canais `fatura:registrarPagamentoParcial` e
`fatura:excluirPagamentoParcial`, no grupo de fatura que já existe — um grupo novo exigiria
registro em duas listas do `main.ts` que já divergiram. Schemas zod em `src/shared`, tipos
em `FaturaApi`, ponte no preload. Aceite: teste do handler recusando valor zero, valor
fracionário e data impossível antes de chegar ao repositório.

**R8 — As leituras passam a trazer pago e falta.** `FaturaComTotal` e `FaturaDetalhada`
ganham `pagoParcialCentavos` e `restanteCentavos`; o detalhe traz também
`excedenteCentavos` e a lista `pagamentosParciais`. Campos obrigatórios: dinheiro opcional
vira `?? 0` espalhado, e zero por omissão é o tipo de erro que não aparece. Aceite: duas
parcelas com dois pagamentos não se multiplicam no SQL do resumo; pagar e reabrir
preservam os pagamentos.

### F2 — A tela de Faturas

**R9 — Registrar** (RF-FAT-07, novo; padrão F). Botão "Pagamento parcial" na faixa de
resumo, em fatura `Aberta` e `Fechada`; ausente em `Paga`; desabilitado, com o motivo,
quando não falta nada. Abre um diálogo com a fatura (cartão, mês, quanto falta), **Valor
(R$)** e **Data do pagamento**, que começa em hoje. "Registrar pagamento" só habilita com
valor válido, maior que zero e dentro do que falta, e data que existe; o motivo aparece no
diálogo. Em fatura `Fechada`, o valor que quita mostra a orientação do R2. Erro do main
fica no diálogo, legível; ele fecha quando dá certo, com aviso, e faixa, trilho e histórico
se atualizam.

**R10 — Faixa de resumo** (RF-FAT-03, padrão G). Sem parcial, como hoje. Com parcial:
"Total da fatura", "Pagamentos parciais" e, em destaque, "Falta pagar" — "Restante pago"
quando a fatura está `Paga`. Havendo pago a mais, a faixa diz quanto, em tom de atenção.

**R11 — Lista de pagamentos.** Painel "Pagamentos parciais" entre a faixa e as parcelas, só
quando há algum: data, valor e Excluir no menu de ações, destrutivo, com confirmação que
repete valor e data. Em fatura `Paga`, Excluir fica desabilitado com o motivo, em vez de
abrir o diálogo e falhar depois (RF-DES-09 fez o mesmo).

**R12 — Marcar como paga e reabrir** (RF-FAT-04, RF-FAT-05). Com parcial, o diálogo de
pagar diz o total, o que já foi pago e o que falta — é o restante que está sendo pago.
Reabrir mantém os pagamentos parciais, e o diálogo diz isso.

**R13 — Trilho** (RF-FAT-06). O número do card é o que falta pagar. Com parcial, uma linha
de contexto: "R$ 200,00 pagos de R$ 800,00".

**R14 — Histórico** (RF-FAT-06). A linha mostra o que falta pagar, com o mesmo contexto
quando há parcial, e a soma da barra acompanha. As abas "A pagar" e "Pagas" seguem pelo
status: fatura com parcial e não marcada continua "A pagar".

**R15 — Prazo sem alarme falso.** Fatura `Fechada` cujos parciais cobrem o total não diz
"vence em N dias" nem "vencida há N dias" no trilho, na faixa e no histórico: não há o que
pagar, só o que marcar. Só acontece com fatura quitada ainda `Aberta` que depois fechou.

### F3 — O mês

**R16 — Sobra do mês** (RN-08, decisão A). As saídas passam a somar cada fatura pelo que
falta pagar (RN-10), em qualquer status — a fatura `Paga` que teve parcial segue abatida.
Aceite, por teste de integração escrito antes: 1.000 de entradas, fatura de 800 e parcial
de 200 dão saídas 600 e sobra 400; marcar como paga não muda o número; pago a mais não vira
saída negativa; mês sem parcial fica idêntico ao de hoje. Evolução do saldo (RF-VIS-05) e
Simulação (RN-09) leem os mesmos totais, com um teste cada.

**R17 — Hero** (RF-VIS-02). A fatia "Faturas" soma o que as faturas pesam no mês, e a nota
dela ganha "R$ X já pagos" quando há parcial — espelho de "R$ X já na conta" das entradas.
O texto de apoio deixa de dizer só que as saídas contam integralmente e passa a dizer que o
pagamento parcial abate a fatura.

**R18 — Card de faturas** (RF-VIS-02). Cada linha mostra o que a fatura pesa, com "de R$
total" quando há parcial. A soma das linhas volta a bater com a fatia do hero. O aviso de
prazo segue o R15.

**R19 — Agenda** (RF-VIS-07). Fechamento e vencimento pelo que falta pagar; com parcial, o
fechamento diz "R$ 600,00 a pagar" no lugar de "acumulados". Fatura sem nada a pagar não
entra, como a zerada já não entrava. Teste de domínio antes.

**R20 — Aviso do sistema** (RF-CFG-02). Sem notificação de vencimento para fatura `Fechada`
coberta pelos parciais. Fatura sem parcial se comporta como hoje, inclusive a vazia.

**R21 — PDF do mês** (RF-EXP-02). A tabela de faturas ganha as colunas "Parciais" e
"Líquido" ao lado de "Total"; "Saídas" já vem da RN-08.

**R22 — CSV do mês** (RF-EXP-01). Uma linha "Pagamento parcial" por pagamento das faturas
do mês exportado, com cartão, data do pagamento e valor. A data pode ser de outro mês: o
pagamento pertence à fatura, e a fatura é do mês exportado.

## 5. Fases

Uma PR por fase, mergeada antes da seguinte. Em cada uma: pipeline local verde (`lint`,
`typecheck`, `tsc -p tsconfig.e2e.json`, `test:coverage`, `build`) e o E2E **proposto** ao
fim — roda só com o seu ok (regra 10), sempre em segundo plano. A release só sai depois da
F3: entre a F2 e a F3 a `main` mostra o falta pagar em Faturas e ainda conta o total na
Visão mensal.

### F1 — `feat/pagamento-parcial-base` — R1 a R8

- **Testes antes:** domínio (`calcularRestanteDaFatura`, com propriedade; as duas
  elegibilidades); migration `0015`; repositório; ida e volta do export; handlers
  (`registrar`, `excluir`, `detalharComParcelas` e `listarResumoPorCartao` com os campos
  novos); schemas.
- **Arquivos novos:** entidade e serviço em `src/domain`, a migration, o repositório e os
  testes deles. **Alterados:** `row-mappers`, `fatura-repository`, `dados-repository`,
  `shared/ipc` (`fatura`, `channels`, `dados`), `fatura-handlers`, `preload`, e as
  fixtures dos testes do renderer que montam `FaturaComTotal` e `FaturaDetalhada`.
- **Mutation testing:** Stryker só no serviço novo do domínio, com o score no PR.
- **E2E:** sem spec novo. A suíte inteira é proposta mesmo assim: muda contrato de IPC e
  entra uma migration no boot de toda instância.
- **PRD:** RN-10 (nova), modelo de dados (seção 6), nota no RN-06, seção 8.
- **Sem dependência nova.**

### F2 — `feat/pagamento-parcial-faturas` — R9 a R15

- **Testes antes:** `RegistrarPagamentoParcialModal` (data em hoje, valor inválido, acima do
  que falta, quitação em `Fechada`, erro no diálogo); `FaturaDetalhe` (botão por status, as
  três leituras da faixa, painel, excluir com confirmação e desabilitado em `Paga`);
  `PagarFaturaModal` com parcial; `TrilhoCartoes`, `HistoricoFaturas` e
  `organizar-faturas`; `aviso-fechamento` sem alarme falso.
- **E2E:** spec novo `faturas-pagamento-parcial` (registrar, conferir faixa e trilho,
  excluir, pagar o restante, reabrir mantendo o parcial). Varredura axe com o diálogo
  aberto e com o painel na tela, nos dois temas.
- **Folha de contato:** semente com um pagamento parcial e captura do diálogo, nos dois
  temas e nas três larguras.
- **PRD:** RF-FAT-07 (novo), RF-FAT-03, RF-FAT-04, RF-FAT-05, RF-FAT-06.

### F3 — `feat/pagamento-parcial-mes` — R16 a R22

- **Testes antes:** integração da RN-08 em `visao-mensal-repository` (os quatro aceites do
  R16), `relatorio-repository` e exportação CSV; domínio de `montarAgendaDoMes`;
  `listarAvisos`; `SaldoHero`, `FaturasCardCompacto`, `AgendaPanel` e a folha de impressão.
- **E2E:** o spec da F2 ganha a Visão mensal (sobra e card depois do parcial). Suíte
  inteira proposta.
- **PRD:** RN-08, RF-VIS-02, RF-VIS-07, RF-CFG-02, RF-EXP-01, RF-EXP-02.
- **Glossário** do `CLAUDE.md` local: "Pagamento parcial" e "Falta pagar".

### Release

Depois da F3: v1.20.0 (`npm version minor`), CHANGELOG e README numa PR de docs, e a
publicação só com confirmação (CLAUDE.md §7.5), em rascunho, com os quatro arquivos e o
`latest.yml` conferido pela URL pública. A nota da versão traz o passo do padrão H: nas
faturas ainda não pagas, apagar a renda avulsa do improviso e registrar o parcial. Para os
meses passados não precisa: a sobra dá o mesmo número dos dois jeitos.

A migration é aditiva (`CREATE TABLE`), e o backup anterior à migration já é feito no boot.
Não pede ensaio na base real.

## 6. Fora do ciclo, anotado

- **Editar** um pagamento parcial (decisão B).
- **Converter** a renda avulsa do improviso em pagamento parcial (decisão B).
- Registrar pagamento parcial a partir da Visão mensal.
- Pagar mais do que falta numa fatura `Aberta`, deixando crédito para as próximas compras.
- Marcar a fatura como paga sozinha quando os parciais cobrem o total.
- Descrição ou observação no pagamento.
- Herdados do `HANDOFF` de 01/10: cabeçalho do `PLANO-FATURAS.md`, capturas do README, os
  dois defeitos gêmeos em Saídas, UTC no `smoke-visual.mjs`.
