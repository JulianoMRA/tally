-- Slice 12.1 — simplificacao pre-Slice 13.
-- 1) Remove tabelas ajuda e contribuidor (decisao de produto: cobrancas a
--    terceiros viram rendas avulsas).
-- 2) Remove coluna categoria.icone (campo nunca usado de fato).
-- 3) Remove coluna renda.categoria_id (rendas nao serao categorizadas).
--
-- defer_foreign_keys permite recriar as tabelas dentro da transacao da migration
-- sem violar FKs intermediarias; o check final, na commit, confirma a integridade.

PRAGMA defer_foreign_keys = ON;

DROP INDEX IF EXISTS idx_ajuda_parcela;
DROP INDEX IF EXISTS idx_ajuda_contribuidor;
DROP TABLE IF EXISTS ajuda;
DROP TABLE IF EXISTS contribuidor;

-- Recriacao de categoria sem icone.
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

-- Recriacao de renda sem categoria_id.
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
