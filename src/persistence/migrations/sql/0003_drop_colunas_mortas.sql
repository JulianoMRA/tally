-- @no-transaction
-- Slice 15 — fecha o débito documentado em 0002.
--
-- Remove colunas mortas que persistiram após o Slice 12.1:
--   * categoria.icone  (não referenciado por nenhum código desde 12.1)
--   * renda.categoria_id  (idem)
--
-- Usa o pattern recreate-table do SQLite. `PRAGMA defer_foreign_keys` NÃO é
-- suficiente — ele adia apenas a checagem de violações de FK, não permite
-- DROP de tabela referenciada por FK ativa (despesa→categoria, recebimento→
-- renda). Solução: desligar `foreign_keys` completamente, que só funciona
-- em autocommit (fora de transação). A diretiva `@no-transaction` no header
-- faz o runner pular o wrapper db.transaction() — a migration então controla
-- seu próprio BEGIN/COMMIT.

PRAGMA foreign_keys = OFF;

BEGIN;

-- categoria sem coluna icone
CREATE TABLE categoria_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('Despesa', 'Renda', 'Ambos')),
  cor         TEXT NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categoria_new (id, nome, tipo, cor, ativo, created_at, updated_at)
  SELECT id, nome, tipo, cor, ativo, created_at, updated_at FROM categoria;

DROP TABLE categoria;
ALTER TABLE categoria_new RENAME TO categoria;

-- renda sem coluna categoria_id
CREATE TABLE renda_new (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                  TEXT NOT NULL,
  tipo                  TEXT NOT NULL CHECK (tipo IN ('Avulsa', 'Recorrente')),
  valor_padrao_centavos INTEGER NOT NULL CHECK (valor_padrao_centavos >= 0),
  dia_esperado          INTEGER CHECK (dia_esperado IS NULL OR dia_esperado BETWEEN 1 AND 31),
  ativa                 INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (tipo = 'Recorrente' AND dia_esperado IS NOT NULL)
    OR (tipo = 'Avulsa')
  )
);

INSERT INTO renda_new (id, nome, tipo, valor_padrao_centavos, dia_esperado, ativa, created_at, updated_at)
  SELECT id, nome, tipo, valor_padrao_centavos, dia_esperado, ativa, created_at, updated_at FROM renda;

DROP TABLE renda;
ALTER TABLE renda_new RENAME TO renda;

COMMIT;

PRAGMA foreign_keys = ON;
