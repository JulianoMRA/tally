-- Pagamento parcial de fatura (out/2026) — RN-10, RF-FAT-07.
--
-- Até aqui o app não tinha o conceito de "quanto foi pago". Pagar uma fatura é
-- um status com uma data (`fatura.status = 'Paga'`, `fatura.data_pagamento`),
-- e o total nunca é gravado: é a soma das parcelas, calculada na leitura
-- (RN-07). Quem pagava uma parte antes do vencimento não tinha onde registrar,
-- e o improviso em uso era lançar o pagamento como renda avulsa — a sobra do mês
-- fechava, e a fatura seguia mostrando um valor que o banco já não cobrava.
--
-- Uma linha por pagamento, e não uma coluna `valor_pago` em `fatura`: os
-- pagamentos acontecem várias vezes no mês, cada um com a sua data, e precisam
-- poder ser excluídos um a um. A soma é feita na leitura, como o total.
--
-- `fatura_id` com ON DELETE RESTRICT, como toda FK do schema. O app nunca apaga
-- fatura, mas a importação de dados apaga todas as tabelas em ordem — é esta
-- restrição que obriga `pagamento_parcial` a ser apagada antes de `fatura` lá.
--
-- O CHECK da data confere só o formato, como o de `despesa.recorre_ate` na
-- 0013: se o dia existe no calendário é conferido no domínio
-- (`podeRegistrarPagamentoParcial`) e no schema do IPC. O que o banco barra é o
-- que deixaria de comparar como texto. O teto do valor (não passar do que falta
-- pagar) também fica no domínio: depende da soma das parcelas, que o CHECK de
-- uma linha não enxerga.
--
-- Aditiva: só CREATE TABLE e CREATE INDEX, dentro da transação padrão do
-- runner. Nenhuma linha existente é tocada, e nenhuma fatura ganha pagamento
-- por conta desta migration — as rendas avulsas do improviso não são
-- convertidas, porque nada no banco as distingue de uma renda avulsa de verdade.

CREATE TABLE pagamento_parcial (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  fatura_id       INTEGER NOT NULL REFERENCES fatura(id) ON DELETE RESTRICT,
  valor_centavos  INTEGER NOT NULL CHECK (valor_centavos > 0),
  data_pagamento  TEXT NOT NULL CHECK (
    data_pagamento GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
  ),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pagamento_parcial_fatura ON pagamento_parcial (fatura_id);
