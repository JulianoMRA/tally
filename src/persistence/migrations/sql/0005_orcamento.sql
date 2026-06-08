-- Bloco D — Orçamento por categoria.
--
-- Armazena um limite de gasto por categoria. No MVP o limite é global
-- (mes_referencia NULL = vale para todo mês); a coluna fica nullable para
-- evoluir para limites por mês de referência sem nova migration de tipo.
--
-- GOTCHA SQLite: uma UNIQUE(categoria_id, mes_referencia) NÃO impede duplicatas
-- quando mes_referencia é NULL (NULLs são considerados distintos). Por isso a
-- unicidade é garantida por dois índices parciais: um para o limite global
-- (mes_referencia IS NULL) e outro para limites por mês (mes_referencia IS NOT NULL).

CREATE TABLE orcamento (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  categoria_id          INTEGER NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  mes_referencia        TEXT,
  valor_limite_centavos INTEGER NOT NULL CHECK (valor_limite_centavos >= 0),
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ux_orcamento_global
  ON orcamento (categoria_id) WHERE mes_referencia IS NULL;

CREATE UNIQUE INDEX ux_orcamento_mes
  ON orcamento (categoria_id, mes_referencia) WHERE mes_referencia IS NOT NULL;
