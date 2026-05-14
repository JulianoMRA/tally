# Estratégia de Modelo e Effort no Claude Code

Guia operacional para decidir qual modelo Claude e qual nível de effort usar em cada tipo de tarefa deste projeto. Otimiza custo sem sacrificar qualidade onde importa.

---

## 1. Princípios

- **Default global**: alias `opusplan` (Opus em plan mode, Sonnet em execution). Boa relação custo/qualidade para a maioria das tarefas.
- **Effort default**: `medium`. Subir só quando a tarefa exige (regras de negócio críticas, debugging complexo, arquitetura).
- **Não subir effort por dúvida**: subir effort para "garantir" mais qualidade em tarefas simples gasta tokens sem ganho real.
- **Usar `ultrathink` pontualmente**: em mensagens específicas com problema difícil, em vez de subir effort da sessão inteira.

---

## 2. Referência rápida

### Modelos
| Modelo | Quando usar |
|--------|-------------|
| **Haiku 4.5** | Tarefas mecânicas, formatação, renomes, ajustes simples, lint/typecheck triagem, docs curtas |
| **Sonnet 4.6** | Implementação padrão, CRUD, UI standard, testes seguindo padrão existente |
| **Opus 4.7** | Arquitetura, regras de negócio críticas, refactor amplo, debugging difícil, decisões de design |
| **opusplan** (alias) | Default da sessão. Combina Opus pra pensar + Sonnet pra executar |

### Effort levels
| Effort | Quando usar |
|--------|-------------|
| `low` | Formatação, renomes, fix de lint, ajustes triviais |
| `medium` | Default. Maioria das tarefas de código, CRUD, testes seguindo padrão |
| `high` | Regras de negócio complexas (RN-01..RN-08), debugging não-trivial, decisões de arquitetura |
| `max` (Opus only) | Problemas realmente difíceis, edge cases obscuros, refactor com muitas implicações |

### Comandos úteis
```
/model              # Trocar modelo (setas esquerda/direita ajustam effort)
/effort             # Slider interativo de effort
/effort high        # Setar nível direto
/effort auto        # Voltar pro default do modelo
ultrathink          # Pedir raciocínio mais profundo só nesta mensagem
```

---

## 3. Mapeamento por slice do roadmap

Default da sessão: `opusplan` com effort `medium`. As recomendações abaixo são **overrides pontuais** quando o slice se beneficia disso.

### Slice 0 — Setup do projeto
**Modelo:** opusplan • **Effort:** medium

Decisões de estrutura (organização de pastas, configuração de bundler, pipeline CI) merecem o plan mode do Opus, mas a execução é boilerplate. Subir para `high` apenas se Claude Code propor escolha de arquitetura controversa que valha discutir.

### Slice 1 — Camada de domínio base
**Modelo:** opus • **Effort:** high

Aqui mora RN-01 (cálculo de fatura por data de compra). Erro nessa função propaga para todos os outros slices. Vale o investimento em thinking. Considerar `ultrathink` ao implementar a função `calcularFaturaDaCompra` especificamente, e ao escrever os testes que cobrem edge cases (compra exatamente no dia de fechamento, virada de ano, fevereiro com 28 dias, etc.).

### Slice 2 — Cartões CRUD
**Modelo:** sonnet • **Effort:** medium

CRUD direto, sem ambiguidade. Sonnet médio é mais que suficiente. Pode até ser haiku low se for uma sessão focada em executar rapidamente formulários e validações simples.

### Slice 3 — Categorias CRUD
**Modelo:** sonnet • **Effort:** medium

Mesma justificativa do slice 2.

### Slice 4 — Despesa única + fatura
**Modelo:** opusplan • **Effort:** medium

Primeira vez ligando UI ao domain via IPC. Plan mode com Opus ajuda a definir o contrato IPC que vai servir para todos os slices seguintes. Execução em Sonnet.

### Slice 5 — Fatura: ciclo de vida
**Modelo:** sonnet • **Effort:** medium

Máquina de estado simples (Aberta → Fechada → Paga). Subir para `high` apenas se aparecer caso de borda inesperado (reabrir fatura paga, fatura sem parcelas, etc.).

### Slice 6 — Despesa parcelada
**Modelo:** opus • **Effort:** high

Slice mais complexo do roadmap. Cobre RN-02 (geração de parcelas), RN-03 (adiantamento), cadastro de parcelas em andamento (migração), cancelamento. Vários casos de borda. Considerar `ultrathink` na função de adiantamento especificamente. Se o Opus parecer estar "errando o algoritmo" repetidamente, subir para `max`.

### Slice 7 — Assinatura
**Modelo:** opus • **Effort:** medium

RN-04 (geração preguiçosa de ocorrências) tem nuance — quando gerar, quanto à frente, como lidar com cancelamento. Não é tão crítico quanto parcelamento, mas merece Opus para o desenho do mecanismo. Se o Opus já gerou o desenho e for só implementar, pode trocar para sonnet medium no meio do slice.

### Slice 8 — Despesas fora de cartão
**Modelo:** sonnet • **Effort:** medium

Variação do que já foi feito em slice 4, sem vínculo a fatura. Sonnet médio resolve.

### Slice 9 — Contribuidores e Ajudas
**Modelo:** opus • **Effort:** high

RN-05 (replicação de ajuda recorrente) tem comportamento sutil: edição pontual não propaga, criação propaga, cancelamento de despesa parcelada afeta ajudas futuras. Modelar isso bem evita bugs futuros. Para a UI do dashboard "A Receber por Pessoa", pode descer para sonnet medium.

### Slice 10 — Rendas e Recebimentos
**Modelo:** sonnet • **Effort:** medium

Paralelo simétrico ao modelo de despesa, porém mais simples (sem parcelamento, sem ajudas). Sonnet médio.

### Slice 11 — Visão mensal consolidada
**Modelo:** opus • **Effort:** medium

RN-07 (cálculo de líquido) e RN-08 (balanço mensal) entram aqui. Não é a primeira vez que aparecem (já existem nos slices anteriores como cálculo isolado), mas aqui são agregados em uma única tela. Opus para o desenho da agregação, sonnet pode executar.

### Slice 12 — Multi-mês e projeção
**Modelo:** opus • **Effort:** high

Projeção exige decidir até quando gerar parcelas/assinaturas/recebimentos preguiçosamente. Decisão arquitetural com impacto em performance e correção. Vale o esforço.

### Slice 13 — Relatórios e gráficos
**Modelo:** sonnet • **Effort:** medium

Implementação visual com biblioteca de gráfico. Lógica de agregação já existe dos slices anteriores. Para componentes específicos de gráfico, pode descer para haiku low.

### Slice 14 — Hardening
**Modelo:** sonnet • **Effort:** medium

Polimento de UX e correção de bugs leves. Para bugs específicos difíceis de reproduzir, subir para opus high pontualmente. Para mensagens de erro, validações de form, atalhos: haiku low.

---

## 4. Mapeamento por tipo de tarefa transversal

Independente de qual slice está rodando, estas tarefas se repetem.

| Tarefa | Modelo | Effort |
|--------|--------|--------|
| Escrever teste seguindo padrão existente | sonnet | medium |
| Escrever teste do zero para RN nova | opus | high |
| Implementar handler IPC seguindo template | sonnet | medium |
| Implementar componente React básico | sonnet | medium |
| Implementar componente React com lógica complexa | opus | medium |
| Migration nova (CREATE TABLE simples) | sonnet | low |
| Migration com transformação de dados existentes | opus | high |
| Bug fix simples (typo, off-by-one, validação faltando) | haiku | low |
| Bug fix em regra de negócio | opus | high |
| Refactor de renomeação | haiku | low |
| Refactor estrutural (mover lógica entre camadas) | opus | high |
| Atualizar README ou CLAUDE.md | haiku | low |
| Code review de PR próprio antes de abrir | sonnet | medium |
| Configurar GitHub Actions workflow | sonnet | medium |
| Debug de teste que falha intermitentemente | opus | high |
| Adicionar dependência e integrar | sonnet | medium |

---

## 5. Heurísticas de uso

### Subir effort quando…
- A função sendo escrita aparece nas RN-XX do PRD.
- O Claude Code propôs uma solução, você implementou, e ela não funciona como esperado em mais de uma tentativa.
- Está modelando uma estrutura de dados nova.
- Está decidindo o contrato de uma camada (IPC, repositório, service).
- Está debugando um bug cuja causa não é óbvia em 5 minutos de leitura.

### Descer effort quando…
- A tarefa tem um padrão claro já estabelecido no projeto (próximo CRUD igual aos anteriores).
- É edição mecânica (renomeação, formatação, ajuste de import).
- O escopo é uma única função pequena com sinal claro de sucesso (teste verde).

### Trocar de Opus para Sonnet quando…
- O Opus já produziu o plano e a discussão arquitetural.
- A implementação restante é "encher linguiça" seguindo o plano.
- Você está em meio a uma sessão longa e quer economizar tokens.

### Usar `ultrathink` em vez de subir effort da sessão quando…
- Apenas uma mensagem específica precisa de raciocínio profundo.
- Você não quer pagar a conta de high/max em todas as mensagens da sessão.
- Exemplos: pedir revisão crítica de uma função, pedir para enumerar edge cases que faltam, pedir análise de complexidade.

---

## 6. Anti-padrões a evitar

1. **Rodar tudo em Opus max** — desperdício de tokens em tarefas que sonnet medium resolve igual. Custo pode ser 10x+ maior.
2. **Rodar tudo em Haiku low** — boa para CRUDs, mas vai produzir código frágil em regras de negócio e perder edge cases.
3. **Subir effort por insegurança** — se o problema é claro, effort medium basta. Effort não substitui especificação clara.
4. **Não usar opusplan** — abre mão de uma otimização free. Plan com Opus, execute com Sonnet, é praticamente sempre o melhor padrão.
5. **Esquecer de descer depois de subir** — após terminar uma tarefa complexa que exigiu high, volte para medium na próxima tarefa rotineira.

---

## 7. Quando consultar este documento

- Antes de iniciar um novo slice do roadmap (seção 3).
- Quando trocar de tipo de tarefa dentro de um slice (seção 4).
- Quando sentir que o Claude Code está "lento e caro" — provável overuse de Opus/high (seção 6).
- Quando sentir que o Claude Code está "errando coisas óbvias" — provável underuse de effort para a complexidade da tarefa (seção 5).
