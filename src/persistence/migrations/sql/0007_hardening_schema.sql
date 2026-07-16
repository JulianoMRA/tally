-- @no-transaction
-- Fase 2 (hardening de dados, jul/2026).
--
-- (1) Indice unico em parcela (despesa_id, numero): nenhum fluxo legitimo gera
--     duplicata (gerarParcelas/gerarOcorrencias numeram sequencialmente e a
--     extensao de horizonte parte de MAX(numero)+1) — duplicata e sintoma de
--     bug ou import corrompido. Criado ANTES do rebuild de fatura: se houver
--     duplicata pre-existente, a migration falha aqui com rollback limpo e o
--     usuario mantem o backup pre-migration feito no boot. Sem dedup
--     automatico: apagar registro financeiro silenciosamente e pior que falhar.
--
-- (2) Rebuild de fatura com CHECK correto de mes_referencia: o GLOB original
--     `[0-1][0-9]` aceitava '2026-00' e '2026-13'..'2026-19'. O INSERT..SELECT
--     re-valida cada linha legada — lixo pre-existente aborta a migration em
--     vez de ser arrastado adiante.
--
-- Mesmo pattern da 0003: `foreign_keys = OFF` exige autocommit (diretiva
-- @no-transaction), pois parcela.fatura_id referencia a tabela dropada.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE UNIQUE INDEX ux_parcela_despesa_numero ON parcela (despesa_id, numero);

CREATE TABLE fatura_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  cartao_id       INTEGER NOT NULL REFERENCES cartao(id) ON DELETE RESTRICT,
  mes_referencia  TEXT NOT NULL CHECK (
    mes_referencia GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    AND substr(mes_referencia, 6, 2) BETWEEN '01' AND '12'
  ),
  data_fechamento TEXT NOT NULL,
  data_vencimento TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('Aberta', 'Fechada', 'Paga')),
  data_pagamento  TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cartao_id, mes_referencia)
);

INSERT INTO fatura_new (id, cartao_id, mes_referencia, data_fechamento, data_vencimento,
                        status, data_pagamento, created_at, updated_at)
  SELECT id, cartao_id, mes_referencia, data_fechamento, data_vencimento,
         status, data_pagamento, created_at, updated_at
  FROM fatura;

DROP TABLE fatura;
ALTER TABLE fatura_new RENAME TO fatura;

CREATE INDEX idx_fatura_cartao_mes ON fatura (cartao_id, mes_referencia);

COMMIT;

PRAGMA foreign_keys = ON;
