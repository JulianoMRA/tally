-- Despesa recorrente FORA de cartão (set/2026) — RF-DES-16 a RF-DES-20.
--
-- Uma despesa que se repete todo mês pagando por Pix, débito ou dinheiro:
-- aluguel, mensalidade, faxina. É o mesmo tipo de domínio da assinatura — a
-- diferença é só de onde sai a data da ocorrência —, então reusa
-- `tipo = 'Assinatura'` com `cartao_id NULL`. O CHECK de tabela criado na 0001
-- já aceita essa combinação: ele só exige `Credito <-> cartao_id NOT NULL`.
-- Confirmado por INSERT antes desta migration ser escrita, não por leitura.
--
-- Duas colunas novas, ambas NULL para todo o resto do app:
--
-- `dia_cobranca` — o dia do mês em que a despesa acontece. Precisa de coluna
-- própria em vez de sair de `data_compra` por causa do clamp: "todo dia 31"
-- começando em fevereiro gravaria 28 na data da primeira ocorrência, e a série
-- inteira herdaria o 28 daí em diante. O clamp não tem volta, então o dia
-- pedido tem de ser guardado como foi pedido.
--
-- `recorre_ate` — data limite da recorrência; NULL significa "sempre, até
-- cancelar". A geração para quando a data da ocorrência ultrapassa o limite,
-- comparando a data JÁ clampada.
--
-- ALTER TABLE ADD COLUMN, e não o create-copy-drop-rename das 0003/0007/0011:
-- medido nesta engine que a `node-sqlite3-wasm` aceita a forma com CHECK e que
-- o CHECK passa a valer de verdade depois do ALTER (um INSERT com
-- `dia_cobranca = 99` foi recusado). Reconstruir a tabela seria custo sem
-- ganho, e as duas colunas são aditivas.

ALTER TABLE despesa ADD COLUMN dia_cobranca INTEGER
  CHECK (dia_cobranca IS NULL OR (dia_cobranca BETWEEN 1 AND 31));

ALTER TABLE despesa ADD COLUMN recorre_ate TEXT
  CHECK (
    recorre_ate IS NULL
    OR recorre_ate GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  );
