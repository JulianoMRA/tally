-- Schema inicial do Tally (PRD §6).
-- Convenções:
--   * IDs: INTEGER PRIMARY KEY AUTOINCREMENT.
--   * Datas: TEXT no formato ISO-8601 (YYYY-MM-DD); mes_referencia como YYYY-MM.
--   * Valores monetários: INTEGER em centavos (evita ponto flutuante).
--   * Timestamps created_at / updated_at: TEXT ISO-8601 com default CURRENT_TIMESTAMP.
--   * Soft delete via flag `ativo` / `ativa` (1 = ativo, 0 = arquivado).

CREATE TABLE cartao (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  nome            TEXT NOT NULL,
  dia_fechamento  INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento  INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor             TEXT NOT NULL,
  ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categoria (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('Despesa', 'Renda', 'Ambos')),
  cor         TEXT NOT NULL,
  icone       TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fatura (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  cartao_id            INTEGER NOT NULL REFERENCES cartao(id) ON DELETE RESTRICT,
  mes_referencia       TEXT NOT NULL CHECK (mes_referencia GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
  data_fechamento      TEXT NOT NULL,
  data_vencimento      TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('Aberta', 'Fechada', 'Paga')),
  data_pagamento       TEXT,
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (cartao_id, mes_referencia)
);

CREATE INDEX idx_fatura_cartao_mes ON fatura (cartao_id, mes_referencia);

CREATE TABLE despesa (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao         TEXT NOT NULL,
  categoria_id      INTEGER NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  tipo              TEXT NOT NULL CHECK (tipo IN ('Unica', 'Parcelada', 'Assinatura')),
  forma_pagamento   TEXT NOT NULL CHECK (forma_pagamento IN ('Credito', 'Debito', 'Pix', 'Dinheiro')),
  cartao_id         INTEGER REFERENCES cartao(id) ON DELETE RESTRICT,
  valor_centavos    INTEGER NOT NULL CHECK (valor_centavos >= 0),
  total_parcelas    INTEGER CHECK (total_parcelas IS NULL OR total_parcelas > 0),
  data_compra       TEXT NOT NULL,
  ativa             INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (forma_pagamento = 'Credito' AND cartao_id IS NOT NULL)
    OR (forma_pagamento != 'Credito' AND cartao_id IS NULL)
  )
);

CREATE INDEX idx_despesa_categoria ON despesa (categoria_id);
CREATE INDEX idx_despesa_cartao ON despesa (cartao_id);

CREATE TABLE parcela (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  despesa_id      INTEGER NOT NULL REFERENCES despesa(id) ON DELETE RESTRICT,
  fatura_id       INTEGER REFERENCES fatura(id) ON DELETE RESTRICT,
  numero          INTEGER NOT NULL CHECK (numero > 0),
  total           INTEGER CHECK (total IS NULL OR total > 0),
  valor_centavos  INTEGER NOT NULL CHECK (valor_centavos >= 0),
  data_referencia TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Paga')),
  data_pagamento  TEXT,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_parcela_fatura ON parcela (fatura_id);
CREATE INDEX idx_parcela_despesa ON parcela (despesa_id);

CREATE TABLE contribuidor (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  contato     TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ajuda (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  contribuidor_id   INTEGER NOT NULL REFERENCES contribuidor(id) ON DELETE RESTRICT,
  parcela_id        INTEGER NOT NULL REFERENCES parcela(id) ON DELETE RESTRICT,
  valor_centavos    INTEGER NOT NULL CHECK (valor_centavos >= 0),
  status            TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Recebida')),
  data_recebimento  TEXT,
  recorrente        INTEGER NOT NULL DEFAULT 0 CHECK (recorrente IN (0, 1)),
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ajuda_parcela ON ajuda (parcela_id);
CREATE INDEX idx_ajuda_contribuidor ON ajuda (contribuidor_id);

CREATE TABLE renda (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                  TEXT NOT NULL,
  categoria_id          INTEGER REFERENCES categoria(id) ON DELETE RESTRICT,
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

CREATE TABLE recebimento (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  renda_id        INTEGER REFERENCES renda(id) ON DELETE RESTRICT,
  valor_centavos  INTEGER NOT NULL CHECK (valor_centavos >= 0),
  data_esperada   TEXT NOT NULL,
  data_recebida   TEXT,
  status          TEXT NOT NULL DEFAULT 'Esperado' CHECK (status IN ('Esperado', 'Recebido')),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recebimento_renda ON recebimento (renda_id);
