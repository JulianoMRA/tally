# PRD — App Desktop de Controle Financeiro Pessoal

> **Status:** Em uso real desde a v1.0.0. Desenvolvimento continua por releases.
> **Owner:** Juliano Melo Rodrigues Alencar
> **Última atualização:** 3 de agosto de 2026 (remoção do CI hospedado — ver 8.4)
>
> **Estado atual:** v1.1.1 publicada. MVP e V2 integralmente entregues (ver 3.2
> e o quadro de releases na seção 9). O repositório não tem mais automação
> hospedada: os workflows do GitHub Actions foram removidos em ago/2026 e o
> pipeline roda localmente (8.4), incluindo a publicação de release (8.6).
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

- ~~Orçamento e metas por categoria com alerta de estouro~~ (entregue: Bloco D global + limites por mês na fase 8, jul/2026 — ver RF-ORC)
- ~~Exportação (CSV, PDF mensal)~~ (entregue na fase 9, jul/2026 — ver RF-EXP)
- ~~Backup e sincronização~~ (entregue: backups automáticos com pasta configurável na fase 5 — apontar para pasta sincronizada dá nuvem)
- ~~Tags e notas livres em despesas~~ (entregue na fase 11, jul/2026 — ver RF-DES-13)

### 3.3 Fora de escopo

- Multi-usuário e autenticação
- Integração com bancos (Open Finance)
- Versão mobile ou web
- Multi-moeda (apenas BRL)
- Multi-idioma (apenas pt-BR)

---

### 3.4 Ideias registradas (sem prazo)

Anotadas para não se perderem. Não são compromisso de entrega nem têm release
prevista; entram no escopo quando forem priorizadas.

- ~~**Fundir a moldura do Electron na aplicação**~~ (entregue em ago/2026 — ver
  RF-APP-01 a RF-APP-04). Saiu em duas etapas: a v1.7.0 removeu a barra de menu
  mantendo os controles nativos via `titleBarOverlay`; a seguinte fundiu a barra
  com o cabeçalho da página e passou a desenhar os próprios controles. **Linux
  ficou de fora** e mantém a moldura padrão.

---

## 4. Requisitos Funcionais

### 4.1 Cartões (RF-CAR)

- **RF-CAR-01** — Cadastrar cartão com nome, dia de fechamento (1–31), dia de vencimento (1–31), cor de identificação e flag ativo.
- **RF-CAR-02** — Editar e arquivar (soft delete) cartões. Cartão arquivado não aparece em formulários de despesa, mas seu histórico permanece visível. Arquivar **pede confirmação explícita** e não fica como botão solto na linha: é ação com consequência e vive no menu de ações, ao lado de Editar. Cartões arquivados aparecem esmaecidos ao fim da lista quando "Mostrar arquivados" está ativo, em vez de trocarem a lista inteira.
- **RF-CAR-03** — Listar cartões ativos com indicadores: total da fatura do mês corrente, próximo vencimento.
- **RF-CAR-04** — A linha do cartão carrega o uso recente, não só o cadastro: total da **fatura do mês corrente** — rotulado "Fatura do mês", e não "Fatura aberta": o valor é o do mês qualquer que seja o status, então o rótulo antigo seguia dizendo "aberta" depois de a fatura fechar ou ser paga —, série dos até **seis meses encerrados** em sparkline e a **média** desse período. A média é omitida quando o histórico soma zero — "média R$ 0,00" não é referência de nada. Cartão sem nenhum mês encerrado exibe "sem histórico"; cartão com meses encerrados e nenhum gasto exibe "sem uso há N meses". Meses futuros ficam de fora: só o passado encerrado é comparável.

### 4.2 Categorias (RF-CAT)

- **RF-CAT-01** — Cadastrar categoria com nome, tipo (Despesa, Renda ou Ambos) e cor.
- **RF-CAT-02** — Editar e arquivar categorias. Despesas vinculadas a categoria arquivada continuam exibindo a categoria com indicador de inativa. Como em RF-CAR-02, arquivar pede confirmação explícita e vive no menu de ações; arquivadas aparecem esmaecidas ao fim da lista.

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
- **RF-DES-11** — Duplicar despesa: pré-preenche o formulário de nova despesa com descrição (sufixo " (cópia)"), categoria, cartão, valor e forma da despesa de origem, na aba correspondente ao tipo. A data não é copiada (nova compra). Não cria nada até o usuário confirmar.
- **RF-DES-12** — Busca por descrição na lista de Saídas: filtro client-side, tolerante a acentos e caixa (substring), combinável com os filtros de tipo/mês.
- **RF-DES-13** — Nota livre e tags por despesa: nota de texto (até 2000 caracteres) e conjunto de tags (nome único case-insensitive, compartilhável entre despesas). Editáveis por despesa; as tags aparecem na linha da lista e há filtro por tag. São metadados — não afetam valores, parcelas nem status de fatura. Migração `0008` adiciona `despesa.nota` e as tabelas `tag`/`despesa_tag` (N:N com CASCADE nos dois lados). Incluídas no export/import JSON (formatVersion segue 1; export antigo importa com listas vazias).
- **RF-DES-14** — **Lista de Saídas por ocorrência do mês.** A tela mostra um mês de cada vez (seletor próprio, abrindo no mês corrente) e uma linha por **ocorrência** — a parcela daquele mês —, não uma por despesa cadastrada. Cada linha traz:
  - **Impacto do mês**: o valor da parcela. É a única grandeza somável da tela, e é o que alimenta o total do período e o subtotal de cada grupo. Vem sempre da parcela gravada, nunca de dividir o valor da despesa: o resto dos centavos fica na última parcela (RN-02) e em parcelada em andamento o valor da despesa é o restante, não a compra.
  - **Valor de origem** (`de R$ X`), como contexto secundário: só para parcelada criada do zero, identificada por possuir parcela número 1. Parcelada cadastrada em andamento não exibe origem — o app guarda o saldo devedor, não o preço da compra.
  - **Rótulo da parcela** (`7/12`, `mensal`, `à vista`). Sem barra de progresso: em largura de coluna real, 8% e 100% de preenchimento ficam indistinguíveis, e o rótulo já diz o progresso melhor. `progressoPct` segue no contrato.
  - **Data da compra**, na coluna **Compra** — quando o compromisso nasceu, não quando o dinheiro sai (esta última é do agrupamento por cartão e de RF-FAT). Para parcelada mostra a data da compra original, ainda que anterior ao mês exibido: saber que a parcela vem de uma compra de fevereiro é o contexto que a linha precisa. Assinatura mostra `desde MM/AAAA`, porque o início pode ser de anos atrás e repetir o dia sugeriria um evento do mês.
  - Agrupamento por **origem do dinheiro**: uma seção por cartão (a fatura daquele mês) e uma para o que sai da conta, cada uma com subtotal. O subtotal de um cartão bate com o total da fatura em RF-FAT. **Ordenar por Compra achata os grupos** num bloco cronológico único: enquanto o agrupamento vale, a ordenação age só dentro de cada seção, e "o mês inteiro em ordem cronológica" não existiria. Qualquer outra ordenação devolve o agrupamento e os subtotais.
  - Ordenação por Descrição, Compra ou Impacto, **todas alcançáveis pelo cabeçalho**. A tela abre por Compra, decrescente. Um padrão de ordenação sem cabeçalho correspondente é inalcançável depois do primeiro clique em outra coluna — foi o que aconteceu quando a coluna de data não existia.
  - Recorte do mês pela **fatura** quando a parcela tem fatura, e por `data_referencia` só para gasto fora do cartão. Uma compra feita depois do fechamento aparece no mês da fatura (RN-01), não no da compra.
  - Ao registrar, a tela salta para o mês em que o lançamento caiu — senão o painel fecharia sobre uma lista que não mostra o que acabou de ser criado.

  > Consequência aceita: Saídas deixa de ser o registro histórico completo. Uma parcelada já quitada não aparece nos meses correntes, e uma assinatura cancelada some dos meses cujas faturas ainda estavam abertas (RF-DES-07 apaga essas ocorrências), podendo desaparecer da lista inteira.

- **RF-DES-15** — **Prévia de destino no cadastro**: com cartão e data preenchidos, o formulário mostra em qual fatura o lançamento vai cair, aplicando RN-01 antes de salvar. Cobre compra única, primeira parcela e primeira mensalidade. Sem isso, lançamento em cartão ou mês errado só aparece depois de salvar e navegar até Faturas.

### 4.4 Faturas (RF-FAT)

- **RF-FAT-01** — Faturas são geradas automaticamente para cada cartão a cada mês de referência conforme parcelas vão sendo vinculadas.
- **RF-FAT-02** — Cada fatura tem status `Aberta` (recebendo novas despesas), `Fechada` (passou da data de fechamento, sem novas despesas) e `Paga` (registrada como paga pelo usuário).
- **RF-FAT-03** — Visualizar fatura com lista de parcelas e total a pagar.
  > A menção a "total de ajudas vinculadas" e "total líquido" ficou obsoleta com a remoção da feature de Ajudas no Slice 12.1 (ver nota em RN-07). Corrigido em ago/2026.
- **RF-FAT-06** — **Tela única de faturas.** Lista e detalhe deixam de ser modos separados:
  - **Trilho de cartões** no topo, um bloco por cartão ativo, sempre com a **fatura corrente** dele — total, status e prazo. O trilho não acompanha o mês exibido no painel: ele responde "como cada cartão está hoje", mesmo enquanto se navega no histórico.
  - **O card nomeia a fatura que exibe**, e o card em foco **admite quando o painel saiu dela** ("painel em dezembro de 2026"). O card é ao mesmo tempo o resumo de hoje e o seletor do painel, e seleção cria expectativa de identidade: sem nomear o mês, os dois totais conviviam na tela sem nada explicando a diferença, e a decisão do item anterior era lida como defeito.
  - **Painel da fatura em foco** abre sem clique nenhum. A fatura corrente é a do mês de referência atual; sem ela, a próxima a vencer; sem nenhuma futura, a mais recente do passado.
  - **Navegação entre meses** (`←`/`→`) anda pelas faturas que existem daquele cartão, em ordem de mês — não soma mês no calendário, porque cartão sem compra num mês não tem fatura.
  - **Histórico** num bloco colapsado, só com meses já encerrados, exibindo o total agregado mesmo fechado, e com filtro por status (`Todas`/`Abertas`/`Fechadas`/`Pagas`) sobre as faturas do cartão em foco. Faturas futuras não entram na lista — um parcelamento de 12x criaria uma parede de linhas idênticas com o mesmo peso do mês corrente.
  - **Deep-link** `?cartaoId=&faturaId=` mantém o formato, então links salvos continuam válidos. `faturaId` passa a significar qual fatura o painel exibe. Link para fatura inexistente **abre a fatura corrente do cartão e avisa**, em vez de exibir estado vazio — não há mais lista atrás para onde voltar.
- **RF-FAT-04** — Marcar fatura como paga. Ação requer confirmação. Após paga, fatura não permite mais edição de parcelas nem recebe novas parcelas (inclusive cadastro retroativo — bloqueado com erro claro).
- **RF-FAT-05** — Reabrir fatura paga (caso de erro): requer confirmação. A fatura reabre como `Aberta` se a data de fechamento ainda não passou, ou como `Fechada` caso contrário (RN-06).

### 4.5 ~~Contribuidores e Ajudas (RF-AJU)~~

> **Removido no Slice 12.1.** Cobranças a terceiros passam a ser registradas
> como Rendas Avulsas (RF-REN-04). Os requisitos RF-AJU-01..06 foram
> descontinuados em 20/05/2026 junto com a tabela `ajuda` e `contribuidor`.

### 4.6 Rendas e Recebimentos (RF-REN)

- **RF-REN-01** — Cadastrar fonte de renda com nome, valor padrão, dia esperado de recebimento e flag ativo. **Fonte de renda existe apenas para entrada constante** — toda fonte é Recorrente. O tipo `Avulsa` foi removido na migration 0011: ele existia só porque o recebimento não tinha onde guardar um nome, e o `valor_padrão` que exigia de uma fonte avulsa não alimentava cálculo nenhum.
- **RF-REN-02** — Renda recorrente gera recebimentos esperados para os próximos N meses (configurável, default 12).
- **RF-REN-03** — Marcar recebimento como recebido, com data efetiva.
- **RF-REN-04** — Cadastrar **entrada avulsa** (freela, presente, venda, reembolso) informando apenas descrição, valor, data esperada e — se já recebida — data de recebimento. **Não exige nem cria fonte de renda:** a descrição vive na própria linha (`recebimento.descricao`). O schema torna os dois estados mutuamente exclusivos: ou o recebimento vem de uma fonte (`renda_id`), ou tem nome próprio (`descricao`), nunca ambos e nunca nenhum. Editar uma entrada avulsa (descrição, valor, datas) é permitido; editar recebimento de fonte recorrente não, porque valor e dia derivam da fonte (RF-REN-05/06) e o próximo reajuste sobrescreveria a alteração.
- **RF-REN-05** — Editar valor padrão da fonte recorrente afeta recebimentos futuros ainda não recebidos.
- **RF-REN-06** — Editar fonte de renda: nome, valor padrão e (Recorrente) dia esperado. Mudar dia esperado recalcula `data_esperada` dos recebimentos Esperado, clampando ao último dia de meses curtos. Recebidos preservam.
- **RF-REN-07** — **Status do recebimento em uma frase.** A linha deixa de ter duas colunas de data — "esperada DD/MM/AAAA" e "Recebido DD/MM/AAAA" — que diziam quase a mesma coisa. Uma frase só descreve o que aconteceu: `na conta em DD/MM` quando o dinheiro entrou (ou `na conta`, quando a data efetiva não foi registrada), `previsto para hoje`, `previsto para DD/MM · em N dias` quando ainda vai cair, e `previsto para DD/MM · atrasado N dias` quando a data passou sem entrada — este último destacado, porque é o caso que pede ação. Um **ponto de estado** acompanha a linha: preenchido quando o dinheiro está na conta, anel vazado quando é previsão. O valor só usa a cor de entrada quando já entrou.
- **RF-REN-08** — **Progresso do mês numa barra.** Substitui os três cards de peso igual (Esperado / Recebido / Total do mês), que não se liam como soma. A barra mostra a fatia já recebida sobre o total do mês, com o número principal em `recebido de total` e a nota `falta R$ X · N entradas` abaixo. Ao lado, a **média de entradas dos meses anteriores** como referência — o total do mês sozinho não diz se foi um mês bom. A média exclui o mês corrente, que ainda está em curso, e é omitida quando não há histórico de entradas, porque "média R$ 0,00" não é comparação de nada.
- **RF-REN-09** — **Arquivar e desarquivar fonte de renda.** Arquivar apaga os recebimentos ainda Esperado e preserva os Recebido, que são histórico. Desarquivar reativa a fonte **e regenera o horizonte a partir de hoje** (RF-REN-02, N meses), pulando os meses que já têm recebimento — o Recebido preservado pelo arquivamento não ganha um Esperado irmão, e o mês não conta a mesma entrada duas vezes. A regeneração não retroage: uma fonte criada em junho e desarquivada em setembro passa a gerar de setembro em diante, porque os meses arquivados não tiveram aquela entrada. Sem essa regra, uma fonte que nunca teve Recebido voltava sem nenhum recebimento e não alimentava mês nenhum — ativa na lista e inerte no cálculo. Desarquivar uma fonte já ativa é no-op: não estica o horizonte.

### 4.7 Configurações (RF-CFG)

- **RF-CFG-01** — Tela de Ajustes com: pasta de destino dos backups (padrão: `<userData>/backups`), backup ao sair (on/off), retenção de backups (1–100, padrão 10), avisos de fatura on/off e dias de antecedência (0–15, padrão 3). Persistido em `settings.json` no `userData` — fora do SQLite (não consome migration nem entra no export/import de dados). Arquivo ausente/corrompido cai nos defaults sem impedir o boot; campos ausentes (versão antiga) assumem default individualmente.
- **RF-CFG-02** — Avisos de fatura: notificações do SO para faturas Abertas prestes a fechar e Fechadas prestes a vencer, dentro da janela de `diasAntecedenciaAviso`, checadas no boot e no timer horário; no máximo um aviso por fatura/tipo/dia (dedup em memória — reiniciar o app relembra). Pagas nunca avisam; datas passadas não geram aviso retroativo. Na visão mensal, faturas Abertas com fechamento a até 7 dias exibem o rótulo "fecha em N dias".
- **RF-CFG-03** — Cópias de segurança na tela de Ajustes: lista as cópias existentes com data/hora e tamanho, permite criar uma sob demanda ("Fazer cópia agora") e abrir a pasta no explorador do sistema. **Restaurar substitui a base inteira** e por isso não fica como botão solto na linha — vive no menu de ações da cópia, marcado como destrutivo, e **exige confirmação explícita**. Antes de sobrescrever, o estado atual vira uma cópia nova: restaurar por engano não é caminho sem volta. A janela recarrega no fim, depois de o main fechar e reabrir o SQLite. A retenção de RF-CFG-01 vale também para essas cópias.
- **RF-CFG-04** — A tela de Ajustes sinaliza mudança não salva e mantém "Salvar ajustes" sempre à vista, em barra fixa no rodapé. O botão confirma todas as seções de uma vez, então precisa ser alcançável de qualquer ponto da rolagem — e o usuário precisa saber que há alteração pendente antes de sair da tela.

### 4.8 Importação de dados (RF-IMP)

- **RF-IMP-01** — Importar dados em lote via CSV com templates fixos (um por tipo): gastos fora de cartão, compras únicas de crédito, parceladas (novas ou em andamento, informando valor da parcela), assinaturas, rendas recorrentes e recebimentos avulsos. Modelo baixável por template. Delimitador `;` (fallback `,`), datas `YYYY-MM-DD`, valores `1.234,56`. Categorias e cartões são referenciados por nome (case-insensitive, apenas ativos) e precisam existir antes.
- **RF-IMP-02** — Preview antes de importar: contagem de linhas válidas e tabela de erros com o número da linha do arquivo e o motivo. A importação só é liberada com 100% das linhas válidas.
- **RF-IMP-03** — Importação atômica: o lote inteiro entra em uma transação; qualquer falha (nome inexistente, fatura Paga per RF-FAT-04, constraint) reverte tudo com o número da linha na mensagem. Reusa os fluxos de criação existentes — RN-01/RN-02/RN-04 valem automaticamente.

### 4.9 Visão Mensal e Multi-Mês (RF-VIS)

- **RF-VIS-01** — Mês de referência segue o calendário (Junho/2026 agrupa fatura Inter venc 12/06, fatura Nubank venc 22/06, gastos fora de cartão de 01–30/06 e recebimentos de 01–30/06).
- **RF-VIS-02** — Tela mensal separa **operação** de **análise** em duas abas. A aba **Mês** mostra o saldo do mês como resposta principal, a agenda do horizonte (RF-VIS-07), as faturas do mês, o ranking de categorias e os gastos fora de cartão. A aba **Análise** concentra o que é histórico ou configuração: evolução do saldo (RF-VIS-05), evolução por categoria (RF-VIS-06) e o painel de orçamento (RF-ORC-02).
- **RF-VIS-03** — Navegação entre meses (anterior/próximo) e seletor direto de mês/ano.
- **RF-VIS-04** — Projeção: visualizar mês futuro com parcelas e assinaturas ativas já calculadas e recebimentos recorrentes esperados.
- **RF-VIS-05** — Comparativo: visualizar últimos 6 ou 12 meses com gráfico de evolução de entradas, gastos e saldo.
- **RF-VIS-06** — Relatórios por categoria: ranking de categorias no mês e evolução temporal de uma categoria específica.
  > A pizza de gastos do mês existiu até ago/2026 e foi removida no refactor visual: mostrava o mesmo dado do ranking, que já ordena, e com sete fatias deixava de ser legível. O ranking absorveu a leitura de proporção.
- **RF-VIS-07** — **Agenda do horizonte** ("Ainda vai acontecer"): lista os eventos futuros que compõem o saldo projetado — fechamento e vencimento de fatura, e recebimentos ainda esperados — ordenados por data. Fatura Paga e fatura sem lançamentos não entram (não movem mais o saldo); fatura Fechada emite só o vencimento. O rótulo do horizonte depende de onde o mês exibido está em relação a hoje: **"próximos N dias" só no mês corrente**, "os N dias do mês" num mês que ainda não começou — ancorar o futuro em hoje faria dezembro visto em setembro anunciar "próximos 31 dias", que a partir de hoje seriam setembro e outubro — e "mês encerrado" no passado. Torna o número projetado do RN-08 auditável: sem a lista, ele só pode ser aceito, não conferido.

### 4.10 Orçamento (RF-ORC)

- **RF-ORC-01** — Limite de gasto por categoria com dois escopos: **global** (`mes_referencia` NULL, vale para todo mês) e **mensal** (vale só naquele mês e sobrepõe o global na visão do mês). Upsert por (categoria, escopo); remover respeita o escopo — apagar o limite mensal restaura o global.
- **RF-ORC-02** — Progresso no mês: realizado vs limite efetivo, percentual e status (ok < 80%, alerta >= 80%, estourado >= 100%), com indicação de origem do limite (global ou "este mês"). A **leitura** vive no ranking de categorias da aba Mês, onde o limite efetivo aparece como marca vertical sobre a barra da categoria — um objeto no lugar de dois painéis dizendo o mesmo. A **edição** (definir e remover limite, escolher escopo) fica no painel de orçamento da aba Análise, único lugar onde limites são definidos.

### 4.11 Exportação (RF-EXP)

- **RF-EXP-01** — Exportar o mês em CSV (botão na visão mensal): tabela achatada com uma linha por parcela de fatura (com numeração X/Y), gasto fora de cartão e recebimento; valores no formato `1234,56` (compatível com o parser dos templates de importação) e BOM UTF-8 (Excel pt-BR). Destino via diálogo de salvar. Campo de texto que a planilha avaliaria como fórmula (começa com `=`, `+`, `-`, `@`, tab ou CR) sai prefixado com apóstrofo, que o Excel consome como "tratar como texto" e não exibe; números bem-formados ficam intactos, para a coluna de valor continuar somável. O dado no banco não é alterado — a neutralização é só da serialização.
- **RF-EXP-02** — Exportar o mês em PDF: rota de impressão `#/print/:mes` (sem shell do app) renderizada em janela oculta pelo main e convertida com `printToPDF` (A4). O main aguarda o marcador `data-print-pronto` da página — sem sleep arbitrário.

### 4.12 Janela e ações do aplicativo (RF-APP)

- **RF-APP-01** — **Uma faixa de cromo, não duas.** A janela tem barra de título
  própria de **32px**, no material do app (`--bg-sunk`, a mesma areia da
  sidebar), contendo: o menu do aplicativo saindo da própria marca, o nome da
  tela e os controles de janela. Ela **absorveu o cabeçalho de página**: antes
  havia esta faixa (40px) mais uma `Topbar` (56px) com o `h1`, somando 88px de
  cromo antes de qualquer conteúdo, e o nome "Tally" aparecia duas vezes porque
  a `Sidebar` também o exibe. A fusão devolve ~56px de altura útil a todas as
  telas.
- **RF-APP-02** — **O nome da tela é o `h1`, e vive na barra.** Continua sendo o
  único `h1` da árvore e mantém o texto do item de navegação correspondente: o
  par link-de-nav ↔ `h1` é o que identifica a rota para o leitor de tela. A
  fonte é `handle.titulo` no `router.tsx`, e `titulos-de-rota.test.ts` trava a
  igualdade entre rota, navegação e o `title` que a página declara.
- **RF-APP-03** — **Controles de janela próprios.** Minimizar, maximizar e
  fechar são do app (46×32, a métrica de caption button do Windows 11), com
  rótulo acessível, foco por teclado e o botão do meio alternando entre
  Maximizar e Restaurar conforme o estado real da janela — que o main informa,
  para maximizar por duplo-clique ou por atalho não dessincronizar o glifo. **Em
  Linux eles não são renderizados**: lá a moldura nativa permanece (RNF-02) e
  desenhar os nossos deixaria dois conjuntos na mesma janela.
- **RF-APP-04** — **Menu do aplicativo.** Sai da marca (o T, o wordmark e um
  chevron que dá a pista de que abre algo) e reúne o antigo menu "Arquivo":
  **Exportar dados…** e **Importar dados…** (JSON do banco inteiro — distintos
  do CSV de RF-IMP e do relatório mensal de RF-EXP, e sem outro lugar no app),
  **Verificar atualizações…** e **Sair**. O menu nativo sobrevive escondido
  (`autoHideMenuBar`) contendo apenas "Editar": é ele que registra os
  aceleradores de desfazer, copiar, colar e selecionar tudo.

### 4.13 Simulação (RF-SIM)

Área de rascunho para responder "e se eu gastar X?" sem cadastrar nada. Existe
porque, até aqui, testar uma hipótese exigia criar uma despesa falsa e apagá-la
depois — o que mexe em fatura, parcela e no ciclo da RN-06 para uma pergunta que
não é sobre dado real.

- **RF-SIM-01** — **Área isolada de hipóteses.** Tela que calcula o efeito de gastos e entradas hipotéticos sobre o saldo de um mês **sem criar despesa, parcela, fatura, renda ou recebimento**. Nada do que é digitado aqui entra na RN-08, no ranking de categorias, no orçamento, na exportação ou em qualquer relatório. Os únicos canais IPC que a tela usa são `simulacao:obter`, `simulacao:salvar` e o `visao-mensal:detalhar` — este último só de leitura, para conhecer a sobra projetada do mês.
- **RF-SIM-02** — **Uma lista por mês.** Seletor de mês igual ao da Visão mensal, abrindo no mês corrente. Simular outubro não altera setembro; cada mês nasce vazio.
- **RF-SIM-03** — **Ponto de partida em dois modos**, alternáveis sem perder a lista de hipóteses. **Saldo do mês** (padrão): a sobra projetada daquele mês pela RN-08, o mesmo número do hero da Visão mensal. **Valor que eu digito**: um valor informado pelo usuário, que cobre "tenho 200 na conta hoje" — o app acompanha fluxo mensal e **não tem saldo bancário no modelo**, então esse número não é derivável de nada que ele guarda. O valor digitado é preservado ao voltar para o modo saldo do mês.
- **RF-SIM-04** — **Hipótese.** Cada linha tem descrição, valor unitário, tipo (sai ou entra), repetições (1 a 99, para "100 por fim de semana" caber em uma linha) e um estado ligado/desligado. **Desligar tira a linha da conta sem tirar da lista** — é o que permite comparar cenários sem redigitar. Todos os campos são editáveis na própria linha, e o total do topo se move junto. Valor negativo é recusado: quem dá o sinal é o tipo. Teto de 50 hipóteses por mês.
- **RF-SIM-05** — **Resultado ao vivo.** Sem botão de calcular. O saldo simulado aparece em corpo display, negativo em destaque, com a composição em três parcelas: ponto de partida, entradas simuladas e saídas simuladas. O rótulo é sempre **simulado**, nunca "projetado" ou "previsto", que no resto do app significam dado real ainda não realizado.
- **RF-SIM-06** — **Persistência fora do banco.** A simulação vive num `simulacoes.json` no `userData`, com arquivo próprio — não o `settings.json`, cujo schema invalida o arquivo inteiro quando um campo tem tipo errado e levaria tema, pasta de backups e retenção junto. Não consome migration e não entra no export/import de dados nem no CSV do mês: é rascunho, não dado financeiro. Arquivo ausente, ilegível ou inválido devolve simulação vazia e nunca impede o boot; a validação é **mês a mês**, então um mês corrompido é descartado sozinho.
- **RF-SIM-07** — **Limpar o mês.** Apaga as hipóteses do mês exibido e devolve o ponto de partida ao saldo do mês, com confirmação. Não afeta outros meses nem dado real.

> Fora do escopo da primeira versão, registrado para não se perder: cenários
> nomeados comparados lado a lado, data e categoria por hipótese (que abririam
> a evolução do saldo dia a dia e o cruzamento com o orçamento) e um botão para
> converter uma hipótese em despesa real.

### RF-TEMA — Tema claro e escuro

- **RF-TEMA-01** — **Dois temas.** **Claro** (o Cream de sempre, padrão) e
  **Escuro** (Papel noturno). Não existe modo "seguir o sistema": a escolha é
  explícita e só muda quando o usuário manda.
- **RF-TEMA-02** — **A troca fica no menu do aplicativo** (RF-APP-04), como
  primeiro item. O rótulo nomeia o **destino**, não o estado atual — "Tema
  escuro" quando se está no claro. A barra tem 32px e já carrega marca, título,
  subtítulo, ações e controles de janela; um botão dedicado não caberia sem
  tirar outra coisa.
- **RF-TEMA-03** — **A escolha persiste** em `settings.json`, campo `tema`.
  Fora do SQLite: não consome migration nem entra no export/import de dados.
  Arquivo gravado antes do campo existir assume Claro.
- **RF-TEMA-04** — **A troca é imediata e não recarrega a janela.** Formulário
  em edição não perde o que foi digitado.
- **RF-TEMA-05** — **Sem flash na abertura.** O tema está aplicado antes do
  primeiro paint. São duas causas distintas e as duas são tratadas: a janela
  nasce com `backgroundColor` do tema gravado, e o preload carimba o atributo
  de forma síncrona antes de a folha de estilo ser avaliada.
- **RF-TEMA-06** — **Controles nativos acompanham.** `color-scheme` é
  declarado nos dois temas, para que calendário de data, popup de `select`,
  checkbox e barra de rolagem sejam desenhados pelo Chromium no tom certo.
- **RF-TEMA-07** — **O relatório mensal em PDF é imune ao tema.** Papel A4 não
  tem tema: a folha sai sempre clara, qualquer que seja a preferência. A rota
  de impressão roda numa janela oculta com o mesmo bundle, então a imunidade é
  garantida em duas camadas independentes.
- **RF-TEMA-08** — **Cores de categoria e cartão não mudam.** São dado do
  usuário e aparecem exatamente como gravadas nos dois temas. Nenhuma correção
  automática de luminância.
- **RF-TEMA-09** — **Contraste WCAG AA nos dois temas**, verificado por
  cálculo sobre os pares de texto e superfície e pela varredura axe nas oito
  telas — com os estados de ciclo de vida da fatura presentes.

---

## 5. Requisitos Não-Funcionais

- **RNF-01** — Aplicação desktop offline-first. Banco SQLite local.
- **RNF-02** — Sistemas alvo: Windows (primário, ambiente do dono), Linux (secundário, opcional). macOS não é prioridade.
- **RNF-03** — Tempo de inicialização < 3s em hardware modesto.
- **RNF-04** — Operações de leitura na visão mensal < 200ms para até 10 anos de histórico.
- **RNF-05** — Idioma: pt-BR. Moeda: BRL. Formato de data: dd/MM/yyyy.
- **RNF-06** — Cobertura mínima de testes: 80% no domain layer, 60% global.
- **RNF-07** — Pipeline local verde obrigatório antes de abrir PR: lint + typecheck + testes unitários + build.

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

`id, nome, tipo (sempre 'Recorrente'), valor_padrao_centavos, dia_esperado (1–31, NOT NULL), ativa, created_at, updated_at`

> Coluna `categoria_id` removida na migration 0003 (cobranças a terceiros viraram rendas avulsas — Slice 12.1).
> CHECK: `tipo = 'Recorrente'`. O valor `Avulsa` saiu na migration 0011 (RF-REN-04); a coluna permanece documentando a intenção. `dia_esperado` virou NOT NULL na mesma migration — a exigência era condicional ao tipo, e sem `Avulsa` ela vale sempre.

### Recebimento

`id, renda_id (nullable), descricao (nullable), valor_centavos, data_esperada, data_recebida (nullable), status (Esperado|Recebido), created_at, updated_at`

> CHECK: `renda_id` e `descricao` são mutuamente exclusivos e exatamente um está preenchido — recebimento de fonte recorrente herda o nome dela; entrada avulsa traz o seu. Adicionados na migration 0011.

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

#### Data de vencimento do ciclo

Com `dia_vencimento = V`, a fatura de um mês de referência vence em V **desse
mesmo mês** quando `V >= F`, e em V do **mês seguinte** quando `V < F`. Dias que
não existem no mês são clamped ao último dia (31 em fevereiro → 28/29).

O mês de referência continua sendo o do **fechamento**, mesmo quando o
pagamento acontece no mês seguinte: a fatura é agrupada pelo ciclo que a
originou, não pela data em que o dinheiro sai.

Exemplo de cartão que fecha 24 e vence 01 (F=24, V=01):

- Compra 09/08 → fatura de referência 2026-08, fecha 24/08, vence 01/09
- Compra 25/08 → fatura de referência 2026-09, fecha 24/09, vence 01/10

> Regra explicitada em 09/08/2026. Antes, fechamento e vencimento eram sempre
> calculados no mesmo mês — correto para os dois cartões de exemplo acima
> (ambos com V > F), mas em um cartão com V < F a fatura vencia antes de fechar:
> nascia vencida, esvaziava a janela `Fechada` de RN-06 e nunca gerava aviso de
> vencimento próximo. Migration `0009` corrige as faturas já gravadas.

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

### RN-09 — Saldo simulado

`saldo simulado = ponto de partida + soma(entradas hipotéticas ativas) − soma(saídas hipotéticas ativas)`

O efeito de cada hipótese é `valor × repetições`. Hipótese desligada não entra
em nenhum dos dois totais. O ponto de partida pode ser negativo — é resultado de
cálculo (a sobra projetada da RN-08 ou um valor digitado) e o mês pode estar no
vermelho; o valor de uma hipótese, não, porque valor monetário negativo não é
representável no projeto e o sinal vem do tipo.

**Esta regra não alimenta nenhuma outra.** Ela lê a RN-08 quando o ponto de
partida é o saldo do mês, e nada mais no app lê o resultado dela.

---

## 8. Estratégia de QA

### 8.1 Testes unitários (Vitest)

- **Cobertura mínima**: 80% no domain layer (regras de negócio RN-01 a RN-09), 60% global.
- **Foco**: cálculo de fatura por data de compra (RN-01), geração de parcelas (RN-02), adiantamento (RN-03), geração de ocorrências de assinatura (RN-04), ciclo de vida da fatura (RN-06), total da fatura (RN-07), balanço mensal (RN-08), saldo simulado (RN-09).
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

### 8.4 Pipeline local

O projeto **não usa CI hospedada**. Os workflows do GitHub Actions foram
removidos em ago/2026 (histórico da decisão abaixo). O pipeline roda na máquina
do mantenedor, na ordem abaixo, antes de abrir PR:

1. Lint (ESLint)
2. Typecheck (`tsc -b --noEmit`, inclui os specs E2E)
3. Test (`vitest run --coverage` — thresholds RNF-06 são gate)
4. Build (Electron build)
5. E2E (`playwright test`), incluindo varredura de acessibilidade (axe-core) nas
   telas principais — violações serious/critical quebram a suíte
6. Mutation testing com Stryker no domain layer (lento; ao mexer em regra de
   negócio)
7. `npm audit --omit=dev --audit-level=high`

Automação que resta são os hooks do Husky: `pre-commit` (ESLint + Prettier nos
staged), `commit-msg` (commitlint) e `pre-push` (lint + typecheck + suíte
unitária).

**Histórico das remoções.** Dependabot saiu em jul/2026: o volume de PRs de
deps-dev e de actions superava o valor num projeto pessoal de um mantenedor.
CodeQL saiu em jul/2026: code scanning exige GitHub Advanced Security em
repositório privado, então o workflow reprovava todo PR sem nunca publicar
resultado. Os três workflows restantes (`ci`, `mutation`, `release`) saíram em
ago/2026, a pedido do mantenedor — o repositório deixa de ter qualquer
automação hospedada, incluindo a publicação de instaladores, que passa a ser
manual (ver 8.6).

Determinismo dos E2E: a fixture força a janela para 1280x800 após o launch —
telas menores fazem o clamp do SO colapsar grids (colunas 1fr com largura zero),
gerando falhas que não reproduzem em janela cheia. A trava foi criada para os
runners de CI e continua valendo para execução local em monitores pequenos.

Branch `main`: PR obrigatório para merge, conventional commits. A verificação
que era gate de CI passa a ser responsabilidade local de quem abre o PR.

### 8.5 Documentação de bugs

Bugs encontrados durante desenvolvimento ou uso real são registrados como GitHub Issues seguindo template estruturado (preconditions, steps, expected, actual, severity, evidence). Alinhamento com prática de bug reports do roadmap QA.

### 8.6 Publicação de release

Sem `release.yml`, publicar uma versão é manual:

1. `npm version <patch|minor|major>` (nunca criar a tag na mão)
2. `npm run dist` — gera NSIS + portable em `release/`
3. Criar o release no GitHub para a tag e subir os instaladores **junto com o
   `latest.yml`** gerado pelo electron-builder

O `latest.yml` não é opcional: é o arquivo que o auto-update (electron-updater)
lê para descobrir que existe versão nova. Sem ele no release, o app instalado
não recebe atualização.

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

Após o slice 14 o projeto saiu do modelo de slices e passou a entregar por
release. O que veio depois:

| Release | Entrega principal                                                                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1.0.0  | Auditoria completa do app fechada em 6 PRs (jun/2026): RN-06 passa a valer de fato, proteção de fatura Fechada, datas no fuso local, feedback de erro em todas as telas                                                  |
| v1.1.0  | As 11 fases do plano de melhorias (jul/2026). **Fecha todo o V2 do PRD** — orçamento, exportação, backup e tags/notas —, mais auto-update, importador CSV, notificações de fatura e página de Ajustes                    |
| v1.1.1  | Release de correção (jul/2026): ações da tabela de Saídas inalcançáveis por `overflow: hidden`                                                                                                                           |
| v1.2.0  | Plano de UI/UX (ago/2026): Topbar, controles segmentados unificados, ações de linha em menu overflow, largura de página centralizada no `PageContainer`, varredura a11y com dados e gate de teclado                      |
| v1.2.1  | Release de correção (ago/2026): falhas do auto-updater ficavam invisíveis e o nome do artefato divergia do `latest.yml`                                                                                                  |
| v1.2.2  | Release de correção (ago/2026): vencimento calculado no mês seguinte quando o dia de vencimento é anterior ao de fechamento                                                                                              |
| v1.2.3  | Release de correção (ago/2026): fatura residual de cartão arquivado seguia visível; datas das faturas passam a se realinhar ao editar o cartão                                                                           |
| v1.3.0  | Refactor visual, lote 1 (ago/2026): hero de saldo e agenda na visão mensal, `SidePanel`, Saídas com a lista assumindo a tela e impacto mensal por ocorrência                                                             |
| v1.4.0  | Refactor visual, F5 (ago/2026): Faturas em tela única, com trilho de cartões e a fatura corrente sem nenhum clique                                                                                                       |
| v1.5.0  | **Fecha o refactor visual** (ago/2026): Rendas, Cartões, Categorias, Ajustes e Importar, mais o sistema — uma largura de página, seis degraus de tipo e três densidades. Nove fases, 17 pontos                           |
| v1.5.1  | Release de correção (ago/2026): a data da compra volta à lista de Saídas, e a ordenação por ela deixa de ser inalcançável depois do primeiro clique em outra coluna                                                      |
| v1.6.0  | Passador de mês em Rendas (ago/2026): as setas de mês anterior e próximo saem de Visão mensal e Saídas e viram o componente `SeletorMes`, usado pelas três telas                                                         |
| v1.6.1  | Release de correção (ago/2026): clicar fora do modal de nota descartava o texto digitado; o esqueleto repetido em seis modais vira o primitivo `Modal`                                                                   |
| v1.6.2  | Varredura de consistência (ago/2026): mensagens de erro cruas em três telas, tela travando em "Carregando…" por rejeição sem `.catch`, e o CSS de tabela duplicado vira o primitivo `Table`                              |
| v1.7.0  | Barra de título própria (ago/2026): as duas faixas de cromo do sistema viram uma, o menu "Arquivo" migra para dentro do app e a marca deixa de aparecer duas vezes                                                       |
| v1.8.0  | Barra funde com o cabeçalho (ago/2026): 88px de cromo viram 32px, o nome da tela sobe para a barra, o menu sai da marca e os controles de janela passam a ser do app                                                     |
| v1.9.0  | Tema escuro (ago/2026): paleta Papel noturno alternável pelo menu do app, com a divisão de `--forest` que ela exigiu, o PDF mensal blindado contra o tema e três defeitos anteriores corrigidos                          |
| v1.10.0 | Entrada avulsa sem fonte de renda (ago/2026): registrar um freela deixa de exigir o cadastro de uma fonte; mais a neutralização de fórmula no export CSV e a remoção do código morto acumulado                           |
| v1.10.1 | Motor de renderização em dia (ago/2026): Electron 42.3.3 para 42.10.1, fechando a última advisory que atingia o binário instalado; mais o `smoke:visual`, quebrado desde a v1.10.0                                       |
| v1.11.0 | Uma gramática de valor (ago/2026): `parseCentavos` em cinco cópias e o regex de valor em dez viram um módulo só, e o ponto passa a ser resolvido pelo que vem depois dele — milhar ou decimal                            |
| v1.11.1 | Restauração de backup blindada (ago/2026): só se restaura uma cópia que o próprio app lista, e a retenção deixa de apagar justamente a cópia escolhida                                                                   |
| v1.11.2 | Statements finalizados e guardas de fronteira (ago/2026): prepared statements deixam de vazar e de travar tabela para DDL, guarda de navegação passa a exigir o mesmo documento, e o gate do `npm audit` sai do vermelho |

O V2 da seção 3.2 está integralmente entregue.

---

## 10. Métricas de sucesso

- **Funcional:** dono do projeto consegue migrar 100% dos dados da planilha atual e abandonar o uso da planilha em até 2 meses após release do MVP.
- **Técnico:** cobertura de testes mantida nos limites definidos; pipeline local verde antes de todo PR.
- **Portfólio:** projeto público no GitHub com README detalhado, histórico de commits convencionais, testes visíveis, screenshots/GIFs de uso.
