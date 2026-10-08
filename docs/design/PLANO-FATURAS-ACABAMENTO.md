# Plano — Faturas: o que a tela perde ao agir, e acabamento (out/2026)

> **Aprovado em 02/10/2026**, com as decisões A a F como estão. As três fases estão
> mergeadas (PRs #165, #166 e #167) e saem na v1.21.0.

Origem: análise de 02/10/2026, pedida logo depois da v1.20.0 ("analise profundamente a tela
e procure por inconsistências ou erros visuais e de UX"). Mesmo fluxo dos dois ciclos
anteriores de Faturas: análise, requisitos, plano e implementação, com aprovação entre as
etapas.

---

## 1. A tese

Os dois ciclos anteriores arrumaram o que a tela **mostra**: a regra da fatura corrente, a
faixa acima das parcelas, o vocabulário de Saídas, o pagamento parcial. O que sobrou é de
outro tipo.

Primeiro, o que a tela **faz depois de um clique**. Toda ação — registrar um pagamento,
editar, excluir, adiantar, fechar, pagar, reabrir — desmonta o trilho, o painel e o
histórico e os monta de novo. O conteúdo volta certo, e por isso nenhum teste reclama; o
que não volta é o estado de quem estava usando: o histórico aberto, o filtro, a ordenação
da tabela, a posição na página e o foco de teclado.

Segundo, o acabamento dos dois blocos que mais mudaram. O histórico ainda usa a aparência
de quando era uma lista de cartões soltos na página, agora dentro de um painel. A faixa de
resumo foi desenhada para uma linha e, com o botão de pagamento parcial, passou a quebrar
na janela padrão sem que a quebra tenha sido desenhada.

## 2. Decisões

Tomadas por Juliano em 02/10/2026 — todas as recomendadas.

| #   | Decisão                           | Escolha                                                                                                    |
| --- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A   | Anel de foco                      | **Regra local** nos dois seletores que o cancelam, mais um guard por teclado. O anel global não muda       |
| B   | Setas de navegação                | **As duas juntas, antes do título.** Muda a forma descrita no R16 do plano de set/2026                     |
| C   | Histórico e a fatura aberta       | **A fatura aberta continua na lista**, marcada como em exibição. A soma vira "R$ X a pagar"                |
| D   | Volta para a fatura corrente      | **Clicar no cartão em foco**, quando o painel saiu da corrente, volta para ela                             |
| E   | Fatura paga com pagamento parcial | **Só o texto do contexto.** O número principal fica como a decisão G do plano de pagamento parcial definiu |
| F   | Quebra da faixa de resumo         | **A segunda linha ocupa a largura toda**: valores à esquerda, ações à direita. Total e ação seguem juntos  |

Dos 19 achados da análise, 15 entram. Os quatro que ficam de fora estão na seção 6, com o
motivo.

## 3. O que mudou desde a análise

Cinco achados do detalhamento e um da primeira folha de contato. Nenhum muda uma decisão;
dois tiram itens do ciclo.

1. **A folha de contato não mostra foco de teclado.** Na folha de 01/10, nos dois temas,
   `estado-foco-de-teclado.png` e `estado-painel-novo-cartao.png` têm o mesmo SHA-256: são a
   mesma imagem. O script foca o swatch com `.focus()` logo depois de um clique de mouse, e
   ao que tudo indica o Chromium não acende o `:focus-visible` nesse caso. É folha de
   revisão que mente em silêncio, o defeito que o próprio script descreve como o pior que
   ela pode ter. Vira parte do **R6**, e o guard do **R5** usa a tecla `Tab` de verdade pelo
   mesmo motivo.
2. **Parar de desmontar o painel cria duas obrigações.** Hoje o painel renasce a cada troca
   de fatura, e isso apaga de graça o erro de uma ação do ciclo e descarta qualquer resposta
   atrasada. Mantido montado, o erro de "Marcar como paga" em outubro apareceria em
   novembro, e uma resposta lenta da fatura anterior poderia cobrir a mais nova. Entram no
   **R3**.
3. **Há dois botões "Fechar" na tela ao mesmo tempo.** O da janela (`aria-label="Fechar"`,
   desde a v1.8.0) e o do diálogo "Fechar fatura?". O helper `confirmar` de
   `excluir-despesa.spec.ts` existe por causa disso. Reforça o **R18**.
4. **Dois itens de texto saem.** Renomear o botão "Pagamento parcial" para um verbo: o PRD o
   nomeia em RF-FAT-07, ele é seletor em specs e na folha de contato, e "Registrar pagamento
   parcial" casaria por substring com o "Registrar pagamento" do diálogo — a mesma armadilha
   de "Não pagas" e "Pagas". E mostrar o vencimento junto do aviso no trilho: ganho pequeno
   para uma linha a mais no card. Os dois ficam anotados na seção 6.
5. **Três achados seguem sem medição ao vivo** — o anel de foco (R5), a seta que muda de
   lugar (R16) e a vista depois de abrir pelo histórico (R4). O primeiro teste de cada um é
   escrito para falhar no código de hoje. Se passar, o achado estava errado e o requisito
   sai do ciclo, registrado aqui. É a lição do ciclo anterior aplicada na ida: teste verde
   não é prova, e achado não medido também não.
6. **A folha de contato da F1 foi a primeira vez em que a tela pôde ser vista rodando**, e
   trouxe três coisas. O anel de foco da linha do histórico aparece em cima e embaixo e é
   **cortado nas laterais**: a linha encosta na borda do painel, que recorta o que passa
   dela. Fica para o **R7**, que redesenha a linha — o anel dela passa a ser desenhado por
   dentro. O aviso "painel em dezembro de 2026" **acrescenta uma linha ao card** e empurra a
   página uns 30px quando aparece: entra no **R13**. E o swatch ativo do `ColorPicker`, que
   a análise tinha como candidato ao mesmo defeito de foco, **mostra o anel**: a suspeita
   sai da seção 6.

## 4. Requisitos

Cada requisito cita o RF/RN que toca e diz como se prova. O ciclo não tem regra de negócio
nova: nada muda em `src/domain`, no banco nem no contrato IPC. Todo teste vem antes do
código que o faz passar.

### F1 — O que a tela perde ao agir

**R1 — A tela não desmonta ao recarregar** (RF-FAT-06, RF-FAT-07). "Carregando…" aparece só
enquanto não há o que mostrar: a primeira carga dos cartões e do resumo. Em toda recarga
depois disso, trilho, painel e histórico continuam montados e trocam de conteúdo quando a
resposta chega. Falha na recarga se comporta como hoje: a mensagem de erro no lugar do
conteúdo.

Aceite, por teste de página escrito antes: com o histórico aberto na aba "A pagar" e a
tabela ordenada por Valor, registrar um pagamento parcial mantém o histórico aberto, a aba,
a ordenação e o mesmo nó do trilho; "Carregando…" não aparece entre o clique e o resultado.
No E2E, a posição de rolagem depois de editar a última linha de uma fatura longa é a de
antes.

**R2 — Uma leitura por ação.** `recarregarDetalhe` lê o detalhe e chama dois callbacks, e
cada um relê o mesmo detalhe: são três leituras a cada pagamento parcial, edição, exclusão
ou adiantamento. Passa a haver um callback só, e uma ação provoca uma leitura do detalhe e
uma do resumo de cada cartão. Aceite: `detalharComParcelas` é chamado uma vez depois de
registrar um pagamento.

**R3 — Trocar de fatura não desmonta o painel** (RF-FAT-06). Navegar pelas setas ou abrir
pelo histórico mantém o painel montado, com o conteúdo anterior até o novo chegar. Trocar de
**cartão** continua trocando o painel inteiro.

- A seta acionada continua com o foco. Na última fatura, em que ela fica desabilitada, o
  foco passa para a seta que continua valendo.
- A ordenação escolhida vale para a fatura seguinte, como o filtro de Saídas vale para o
  mês seguinte.
- O erro de uma ação do ciclo pertence à fatura em que ocorreu e não acompanha a navegação.
- Resposta atrasada de uma fatura anterior não cobre a mais nova.

Aceite: testes de página para os quatro itens, o último com dublê lento de propósito; E2E
acionando "Próxima fatura" duas vezes seguidas com `Enter`.

**R4 — Abrir pelo histórico leva ao painel** (RF-FAT-06). Depois de clicar numa linha do
histórico, o título do painel fica visível e recebe o foco. Hoje o clique troca o painel,
que fica acima da lista, e nada cuida da rolagem nem do foco. Aceite: teste de página (o
foco está no título) e E2E (`toBeInViewport` do título, numa fatura com linhas suficientes
para o histórico ficar abaixo da dobra).

**R5 — Anel de foco no histórico e no trilho** (decisão A). As linhas do histórico e os
cartões do trilho, o selecionado inclusive, mostram o anel de foco do design system quando
focados pelo teclado. O anel é um `box-shadow` no `:focus-visible` global; `.faturaItem` e
`.trilhoItemAtivo` declaram `box-shadow` com a mesma especificidade, num CSS de chunk que
carrega depois, e como o global zera o `outline` não sobra indicação. A correção é uma
regra `:focus-visible` nos dois.

Aceite: caso novo em `foco-teclado.spec.ts`, escrito antes. Chega ao cartão selecionado e à
primeira linha do histórico pela tecla e confere que o `box-shadow` computado é o do anel,
lido de uma sonda com a mesma variável — e não só "diferente de `none`", que a sombra do
próprio item já satisfaz.

**R6 — Folha de contato** (ferramenta de revisão, sem RF).

- As capturas de foco passam a usar a tecla `Tab`, e a folha confere sozinha que o foco
  aparece: fotografa de novo sem ele, e imagens iguais viram erro da execução. Ganha duas
  de Faturas: foco no cartão selecionado e numa linha do histórico.
- A semente ganha os estados que a análise não pôde ver: fatura Paga com pagamento parcial
  e, num quarto cartão de nome comprido, uma fatura com mais de 30 lançamentos e pago a
  mais, seguida de uma Fechada quitada por parciais. Tudo em meses à frente, sem mexer nos
  três estados de orçamento que a semente monta no mês corrente.
- "Hoje" passa a ser calculado em data local. Em UTC, das 21h à meia-noite as capturas saem
  com a data de amanhã — foi assim que a folha de 01/10 mostrou um pagamento de "02/10".

Aceite: a folha roda nos dois temas, e as duas capturas de foco de Faturas diferem da
captura sem foco.

### F2 — Histórico e trilho

**R7 — Linhas do histórico planas** (RF-FAT-06). As linhas perdem a borda, o raio e a sombra
de cartão solto e viram linhas com divisor, como as do card de faturas da Visão mensal. Some
o divisor duplo sob o cabeçalho do painel. Valor e selo ganham colunas estáveis: hoje o
valor vem antes do selo, e como "Paga" e "Fechada" têm larguras diferentes os valores
terminam em bordas diferentes (cerca de 19px na folha de contato).

O anel de foco da linha passa a ser desenhado por dentro dela: por fora, o painel corta as
laterais (seção 3, item 6).

Aceite: caso novo em `alinhamento-de-valores.spec.ts` — a borda direita do valor é a mesma,
com 1px de tolerância, numa linha Paga e numa Fechada. O caso de `foco-teclado.spec.ts`
passa a conferir o anel por dentro. Folha de contato nos dois temas.

**R8 — A fatura aberta continua no histórico** (RF-FAT-06, decisão C). A fatura de mês
encerrado que o painel exibe fica na lista, marcada como "em exibição" (`aria-current`) e
sem a ação de abrir. Hoje ela sai da lista, e as contagens mudam com o que está aberto: com
a única fatura a pagar em exibição, a aba passa de "A pagar 1" para "A pagar 0".

Aceite: teste de `HistoricoFaturas` — com a fatura a pagar aberta, "A pagar" continua
contando 1, e a linha dela está na lista, marcada e sem botão.

**R9 — A soma do histórico ganha nome** (RF-FAT-06, RN-10, decisão C). A barra mostra "R$ X a
pagar": a soma do que falta nas faturas não pagas da lista. Sem nada a pagar — a aba
"Pagas", por exemplo — não mostra valor. Hoje é um número sem rótulo que, em "Todas", soma o
que falta das não pagas com o que foi quitado das pagas.

Aceite: `organizar-faturas.test.ts` para a soma; teste de componente para as três abas.

**R10 — Texto da linha do histórico** (RF-FAT-06). Tempo verbal pelo calendário e uma caixa
só, a do trilho:

- paga: "fechou 25/09/2026 · paga em 05/10/2026";
- não paga e vencida: "fechou 25/06/2026 · venceu 05/07/2026 · vencida há 88 dias";
- não paga, com vencimento por vir: "fechou 25/09/2026 · vence 05/10/2026".

Hoje a linha diz "Fecha" e "Vence" para datas passadas e mistura caixa ("Vence … · vencida
há 88 dias"). Aceite: teste de componente para os três casos.

**R11 — Fatura paga com pagamento parcial** (RF-FAT-06, RN-10, decisão E). No trilho e no
histórico, o contexto de uma fatura `Paga` passa a ser "R$ 200,00 em pagamentos parciais".
Nas não pagas continua "R$ 200,00 pagos de R$ 800,00". O número principal não muda. A faixa
já trata o caso ("Restante pago"); trilho e histórico mostravam "pagos de" ao lado do selo
"Paga", que lê como se só uma parte tivesse sido paga.

Aceite: `descrever-parcial.test.ts`, mais um caso em `trilho-cartoes.test.tsx` e em
`historico-faturas.test.tsx`.

**R12 — Voltar para a fatura corrente** (RF-FAT-06, decisão D). Com o painel fora da fatura
corrente do cartão em foco, clicar nesse cartão volta para ela, e o card diz isso: a linha
do mês passa a ser "voltar para outubro de 2026". Sem divergência o clique segue sem efeito,
para não descartar a fatura aberta. Hoje a saída é seta por seta, ou sair do cartão e
voltar.

O texto aprovado era "painel em junho de 2026 · voltar", numa linha própria. Ele não cabe
na linha do mês ao lado do próprio mês, e numa linha própria é o que o R13 proíbe. Tomando
o lugar do mês, o aviso nomeia o destino do clique em vez do lugar onde o painel está — que
o título do painel, logo abaixo, já diz.

Aceite: `trilho-cartoes.test.tsx` (texto do aviso) e `faturas-page.test.tsx` (o clique
volta; sem divergência não faz nada).

**R13 — Trilho alinhado** (RF-FAT-06). Total e prazo ficam na mesma altura em todos os
cartões de uma linha, com ou sem o selo "Arquivado" e com ou sem contexto de pagamento
parcial. Hoje o selo engrossa a linha do mês e empurra o total uns 7px, e o contexto do
parcial desce o prazo uma linha. O aviso de divergência deixa de acrescentar uma linha ao
card: hoje ele aumenta a altura da fileira inteira e empurra a página quando aparece (seção
3, item 6).

No cartão arquivado a volta divide a linha do mês com o selo "Arquivado", e os dois não
cabem lado a lado: a linha quebrava em duas, e o total descia 24px só nesse card. A
primeira versão aceitava a quebra como caso raro; a folha de contato, com um estado novo
para ele, mostrou que o desalinhamento era o mesmo que este requisito corrige. Decisão de
02/10/2026: enquanto o card oferece a volta, o selo sai da vista. A borda tracejada
continua, e o texto fica para o leitor de tela.

Aceite: três casos novos em `faturas-geometria.spec.ts`. Com um cartão arquivado e um
pagamento parcial na semente, o topo do total e a base do prazo coincidem, com 1px de
tolerância. A altura do trilho é a mesma antes e depois de o painel sair da fatura
corrente. E, com o cartão arquivado em foco, total e prazo seguem alinhados depois de o
painel sair da corrente. Mais um caso em `trilho-cartoes.test.tsx` para o selo.

**R14 — Trilho usa a largura** (RF-FAT-06). Os cartões encolhem até 200px antes de quebrar
linha; o teto de 300px continua, e todos têm a mesma largura, inclusive o que cai para a
fileira de baixo. O grid atual nunca chega ao mínimo: `auto-fit` com `minmax(200px, 300px)`
conta as colunas pelo máximo. Em 1024px cabem três e o terceiro cai para a linha de baixo;
na janela padrão isso acontece a partir do quarto.

A coluna passa a `minmax(200px, 1fr)`, e o teto sai do `max-width` do trilho, calculado
pelo número de cartões (`--cartoes`, que o componente informa): com `1fr` solto, dois
cartões numa janela larga virariam duas lajes de 500px. A primeira tentativa foi flex com
`max-width` em cada cartão; passava nos dois aceites de contagem, e a folha de contato
mostrou o cartão da segunda fileira com 300px ao lado dos de 240px de cima. Por isso a
largura entrou no aceite.

Aceite: no mesmo spec, quatro cartões numa fileira em 1280px e três em 1024px (o quarto na
de baixo), todos com a mesma largura, com 1px de tolerância. E um caso em
`trilho-cartoes.test.tsx` para o número de cartões que o componente informa ao CSS.

### F3 — Faixa, setas e diálogos

**R15 — Faixa sem escada** (RF-FAT-03, decisão F). Valores e ações viram dois grupos. Quando
a faixa não cabe em uma linha, a segunda ocupa a largura toda: valores à esquerda, na mesma
margem do status, e ações à direita. Os rótulos dos valores compartilham a linha de base —
hoje "Falta pagar" fica 1 a 2px abaixo dos outros dois, porque o bloco centraliza grupos com
números de tamanhos diferentes.

Hoje, quando quebra, a primeira linha fica à esquerda e a segunda à direita, com dois vazios
em diagonal. Isso acontece em 1280px sempre que há aviso de prazo ou pagamento parcial —
desde que a faixa ganhou o segundo botão — e o comentário do componente ainda diz "numa
linha só".

Aceite: em `faturas-geometria.spec.ts`, nas três larguras e com pagamento parcial — quando
há quebra, a borda esquerda do primeiro valor é a do selo de status; a base dos três rótulos
coincide; os aceites que já existem continuam valendo (botões dentro da faixa, rótulos em
uma linha, sem rolagem horizontal). Em 1024px e 1280px o caso exige que a faixa quebre: sem
quebra ele não mediria nada.

Feito com dois grupos dentro do fim da faixa — valores e ações — e um fator de crescimento
muito maior no começo (status e datas): numa linha só ele empurra o fim para a direita;
quando a faixa quebra, o fim fica sozinho na segunda linha e leva a largura toda. Em 1024px,
com pagamento parcial, as ações descem para uma terceira linha, à direita.

**R16 — Setas paradas** (RF-FAT-06, decisão B). As duas setas ficam juntas antes do título:
`[←][→] ● Inter · Outubro de 2026`. Hoje a "próxima" vem depois do título, que muda de
largura com o nome do mês: pela largura média dos caracteres na folha de contato, de
fevereiro para março ela anda uns 35px, mais que os 34px do botão. Nome acessível, dica e
seta desabilitada sem vizinha não mudam.

Aceite: E2E escrito antes — a posição da seta "próxima" é a mesma, com 1px de tolerância,
ao navegar por três faturas seguidas. O caso confere também que o título mudou de largura no
caminho: sem isso a seta não teria por que andar nem no código antigo. Teste de componente
para a ordem das setas em relação ao título.

**R17 — Tipografia da faixa** (RF-FAT-03). As datas e o aviso de prazo da faixa passam para
mono tabular, como no trilho, no histórico e nas tabelas. Prova: folha de contato — é o
único requisito sem teste automatizado, e fica dito.

**R18 — "Fechar fatura?"** (RN-06). O botão de confirmação passa a "Fechar fatura": ao lado
de "Cancelar", "Fechar" se lê como fechar o diálogo, e a janela já tem um botão com esse
nome. O texto ganha como desfazer — só fatura Paga reabre (RF-FAT-05), então voltar atrás
num fechamento manual pede marcar como paga e reabrir.

Aceite: `fatura-detalhe.test.tsx`; `excluir-despesa.spec.ts` passa a confirmar por "Fechar
fatura".

**R19 — "Excluir despesa?" diz qual** (RF-DES-09). O diálogo nomeia a despesa: descrição,
valor e, conforme o tipo, "em N parcelas" ou "por mês". Sai o "TODAS" em caixa alta. O
diálogo de excluir pagamento parcial, mais novo, já repete valor e data; este é genérico,
numa tabela densa e para uma ação irreversível.

Aceite: `fatura-detalhe.test.tsx`, um caso por tipo de despesa.

**R20 — Diálogos de data** (RF-FAT-04, RF-FAT-07). "Data do pagamento" nos dois diálogos —
hoje um diz "de" e o outro "do". O de marcar como paga passa a mostrar "Data inválida." junto
do campo, como o de pagamento parcial; hoje só desabilita o botão.

Aceite: `pagar-fatura-modal.test.tsx`.

**Data futura continua aceita** nos dois diálogos (decisão de 02/10/2026): cobre o pagamento
agendado no banco. A pergunta veio da folha de contato da F2, em que a semente pagava uma
fatura com data que ainda não tinha chegado; o domínio só confere o formato, e o PRD não
dizia nada. Fica registrado em RF-FAT-04.

**R21 — Modal de edição** (RF-DES-10). A linha de apoio deixa de mostrar o valor cru do tipo
("Tipo: Unica. Edição direta.") e passa a "Compra à vista." ou "Compra parcelada." seguida do
aviso que já existe. O campo Descrição aceita os 120 caracteres do cadastro — hoje corta em
80, aqui e no modal de assinatura. Os dois modais são compartilhados com Saídas: a mudança
vale lá.

Aceite: `editar-despesa-modal.test.tsx` e o teste do modal de assinatura.

O teto vira uma constante só, `MAX_DESCRICAO_DESPESA`, em `src/shared/ipc/despesa.ts`: os
esquemas do cadastro e da edição e os dois modais passam a ler dela. Os 80 dos modais eram
uma cópia que divergiu.

**R22 — Painel "Lançamentos"** (RF-FAT-03, RF-DES-14). O painel "Parcelas" passa a se chamar
"Lançamentos", como o de Saídas; o vazio vira "Nenhum lançamento nesta fatura." e o
subtítulo da página acompanha. Hoje o painel se chama "Parcelas", conta "lançamentos" e
lista compras à vista. A coluna "Parcela" fica: é a de Saídas.

Aceite: `fatura-detalhe.test.tsx` e os dois usos do título em `faturas-geometria.spec.ts`.

### De onde vem cada requisito

| Achado da análise                           | Requisitos     |
| ------------------------------------------- | -------------- |
| 1 — Recarga total a cada ação               | R1, R2, R3     |
| 2 — Foco de teclado invisível               | R5, R6         |
| 3 — Histórico: cartão dentro de painel      | R7             |
| 4 — Faixa em escada                         | R15            |
| 5 — Seta que muda de lugar                  | R16            |
| 6 — Contagem e soma do histórico            | R8, R9         |
| 7 — Sem volta para a fatura corrente        | R12            |
| 8 — "Fechar fatura?" confirma com "Fechar"  | R18            |
| 9 — "Excluir despesa?" não diz qual         | R19            |
| 10 — Fatura paga com parcial                | R11            |
| 11 — Clique no histórico não leva ao painel | R4             |
| 12 — Trilho desalinhado                     | R13            |
| 13 — Grid do trilho                         | R14            |
| 15 — Duas fontes para o mesmo dado          | R17            |
| 17 — Texto                                  | R10, R20 a R22 |

## 5. Fases

Uma PR por fase, mergeada antes da seguinte. Em cada uma: pipeline local verde (`lint`,
`typecheck`, `tsc -p tsconfig.e2e.json`, `test:coverage`, `build`), folha de contato nos
dois temas e o E2E **proposto** ao fim — roda só com o seu ok (regra 10), sempre em segundo
plano. Sem dependência nova, sem migration e sem mudança de contrato IPC em nenhuma fase.
Mutation testing não se aplica: nenhum serviço do domínio é tocado.

### F1 — `fix/faturas-recarga` — R1 a R6

- **Testes antes:** `faturas-page.test.tsx` (histórico, aba e ordenação mantidos; uma leitura
  do detalhe; foco da seta; erro que não acompanha a navegação; foco no título ao abrir pelo
  histórico), teste de hook com dublê lento para a resposta atrasada, e
  `fatura-detalhe.test.tsx` ajustado ao callback único.
- **Alterados:** `FaturasPage`, `FaturaDetalhe`, `hooks/use-faturas`, `faturas.module.css`,
  `scripts/smoke-visual.mjs`.
- **E2E:** caso novo em `foco-teclado.spec.ts` (R5); spec novo `faturas-estado` com o
  histórico e a rolagem preservados depois de uma ação, a seta acionada duas vezes pelo
  teclado e o título visível depois de abrir pelo histórico.
- **PRD:** RF-FAT-06 ganha o que a tela preserva ao agir e ao trocar de fatura.
- **Folha de contato:** R6 inteiro.

### F2 — `fix/faturas-historico` — R7 a R14

- **Testes antes:** `organizar-faturas.test.ts` (soma a pagar), `descrever-parcial.test.ts`
  (fatura paga), `historico-faturas.test.tsx` (fatura aberta na lista, contagens estáveis,
  soma com nome, os três textos da linha), `trilho-cartoes.test.tsx` (contexto em fatura
  paga, aviso com "voltar") e `faturas-page.test.tsx` (o clique que volta).
- **Alterados:** `HistoricoFaturas`, `TrilhoCartoes`, `FaturasPage`, `organizar-faturas`,
  `descrever-parcial`, `faturas.module.css`.
- **E2E:** caso novo em `alinhamento-de-valores.spec.ts` (R7) e dois em
  `faturas-geometria.spec.ts` (R13, R14). Mapeados e sem mudança esperada, mas dependem do
  histórico ou do trilho e por isso pedem a suíte inteira: `fluxos-fase-8.spec.ts` (botão e
  filtro do histórico), `faturas-overview.spec.ts`, `faturas-cartao-arquivado.spec.ts` e
  `faturas-pagamento-parcial.spec.ts`, que confere "pagos de" no card de uma fatura não
  paga.
- **PRD:** RF-FAT-06 — histórico (linha, fatura em exibição, soma a pagar, texto), trilho
  (volta para a corrente) e o contexto do pagamento parcial em fatura paga.

### F3 — `fix/faturas-faixa` — R15 a R22

- **Testes antes:** `fatura-detalhe.test.tsx` (ordem das setas, "Fechar fatura", diálogo de
  exclusão por tipo de despesa, título e vazio do painel), `pagar-fatura-modal.test.tsx`,
  `editar-despesa-modal.test.tsx` e o teste do modal de assinatura.
- **Alterados:** `FaturaDetalhe`, `FaturasPage` (subtítulo), `PagarFaturaModal`,
  `EditarDespesaModal`, `EditarAssinaturaModal`, `faturas.module.css`.
- **E2E:** casos novos em `faturas-geometria.spec.ts` (R15 e R16); `excluir-despesa.spec.ts`
  confirma por "Fechar fatura"; os dois usos de "Parcelas" em `faturas-geometria.spec.ts`
  viram "Lançamentos".
- **PRD:** RF-FAT-03 (quebra da faixa, nome do painel), RF-FAT-06 (forma da navegação),
  RF-FAT-04 (rótulo da data), RF-DES-09 (o diálogo nomeia a despesa), RF-DES-10 (modal) e a
  nota do diálogo de fechar em RN-06.

### Release

Depois da F3: v1.21.0 (`npm version minor`) — o ciclo muda comportamento visível, e não só
corrige —, CHANGELOG e README numa PR de docs, e a publicação só com confirmação (CLAUDE.md
§7.5), com os quatro arquivos e o `latest.yml` conferido pela URL pública. Se a F1 fizer
falta no uso antes disso, ela sozinha cabe numa v1.20.1.

## 6. Fora do ciclo, anotado

Da análise:

- **Painel "Pagamentos parciais" esticado** (achado 14). É decisão recém-tomada e está no
  PRD (RF-FAT-03); só vale reabrir se incomodar no uso.
- **Menu "⋯" sem saída em fatura Paga** (achado 16). Esconder o gatilho mexe no tratamento
  que RF-DES-09 descreve e que specs conferem, para um ganho pequeno.
- **Adiantar** (achado 18). Dizer quantas parcelas dá para adiantar, e não oferecer a ação
  quando não há nenhuma, pede dado novo no detalhe da fatura.
- **Vazios e erros sem ação** (achado 19), e o nome de cartão truncado no trilho sem dica.
- **Rótulo do botão "Pagamento parcial"** e **vencimento junto do aviso no trilho** (seção
  3, item 4).
- **O "Excluir despesa?" de Saídas segue genérico** ("A despesa e TODAS as parcelas
  pendentes serão removidas"). O R19 nomeia a despesa no de Faturas; o de Saídas é outro
  diálogo, com texto próprio, e fica para quando a tela for mexida. **Resolvido depois do
  ciclo**, junto com os dois defeitos gêmeos abaixo: as duas telas usam o mesmo diálogo.

Achado ao detalhar:

- **O mesmo defeito de foco pode existir em outras telas.** Qualquer elemento focável que
  declare `box-shadow` próprio cancela o anel. O swatch ativo do `ColorPicker` foi conferido
  na folha de contato da F1 e mostra o anel; as outras telas não foram varridas. A saída
  que resolve por construção é a que `tokens.css` já anota: trocar o anel global por
  `outline` com `outline-offset`, que muda pixel no app inteiro e por isso pede ciclo
  próprio. **Resolvido depois do ciclo**, em out/2026: o anel virou `outline`, e uma
  varredura pelo Tab nas telas passou a conferir que ele aparece inteiro e sem mudar a
  forma de ninguém. Ela achou mais três casos: os cabeçalhos ordenáveis e os controles da
  janela com o anel cortado, e a zona de arquivo de Importar sem foco visível.
- **Os outros swatches do `ColorPicker` não são alcançáveis pelo teclado.** Só o escolhido
  é parada de `Tab`, e o grupo não trata as setas. Visto ao trocar a captura de foco para a
  tecla. **Resolvido depois do ciclo**, em out/2026: o grupo segue o padrão do
  `SegmentedControl`. A correção achou um segundo defeito: com uma cor fora da paleta,
  nenhum swatch era parada de `Tab`, e o grupo inteiro sumia do teclado.
- **Fechar uma fatura à mão não tem desfazer direto.** Oferecer "Reabrir" numa fatura
  Fechada antes da data mudaria RF-FAT-05 e RN-06; o R18 só passa a dizer isso no diálogo.

Herdados do handoff de 01/10: capturas do README, a linha do mutation testing no README, UTC
em `e2e/marcar-ocorrencia-paga.spec.ts` e os dois defeitos gêmeos em Saídas (Excluir
oferecido onde a regra bloqueia, e o modal sem a trava para compra à vista em fatura
fechada). Os dois gêmeos foram resolvidos depois do ciclo, em out/2026: a lista do mês
passou a trazer do main o bloqueio de exclusão e o status da fatura de cada ocorrência.
