-- @no-transaction
-- Entrada avulsa deixa de exigir fonte de renda (ago/2026).
--
-- Regra nova: fonte de renda existe SO para entrada constante. Uma entrada
-- avulsa (freela, presente, reembolso) passa a viver sozinha, com descricao
-- propria. Reescreve o RF-REN-04, que ate aqui mandava criar a fonte
-- implicitamente.
--
-- POR QUE a fonte era obrigatoria: `recebimento` nunca teve onde guardar um
-- nome. A descricao vinha do JOIN com `renda`, entao criar a fonte era o unico
-- jeito de o avulso ter como se chamar. Efeito colateral: tres freelas do mesmo
-- cliente viravam tres fontes, e o `valor_padrao_centavos` dessas fontes ficava
-- sendo um retrato congelado do PRIMEIRO recebimento — exibido na lista com
-- aparencia de valor padrao, sem alimentar calculo nenhum.
--
-- Tres movimentos, nesta ordem:
--   (1) `recebimento` ganha `descricao` e o CHECK que torna os dois estados
--       mutuamente exclusivos. Os avulsos herdam o nome da fonte que os criou
--       e soltam o vinculo.
--   (2) as fontes Avulsa, agora sem nenhum recebimento apontando para elas,
--       sao removidas.
--   (3) `renda` e reconstruida sem 'Avulsa' no CHECK de tipo, e com
--       `dia_esperado` NOT NULL — o que era condicional ao tipo passa a valer
--       sempre, porque so sobra Recorrente. O banco passa a impedir por
--       construcao o estado que a regra nova proibe.
--
-- A coluna `tipo` fica, mesmo com um valor unico: remove-la rippleria por
-- row-mappers, entidades, payload de export e testes sem ganho de
-- comportamento. Ela agora documenta a intencao em vez de discriminar.
--
-- Mesmo pattern da 0003 e da 0007: `PRAGMA foreign_keys = OFF` so funciona em
-- autocommit, dai a diretiva @no-transaction no header — o runner pula o
-- wrapper de transacao e a migration controla seu proprio BEGIN/COMMIT.

PRAGMA foreign_keys = OFF;

BEGIN;

-- (1) recebimento com descricao propria -------------------------------------

CREATE TABLE recebimento_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  renda_id        INTEGER REFERENCES renda(id) ON DELETE RESTRICT,
  descricao       TEXT,
  valor_centavos  INTEGER NOT NULL CHECK (valor_centavos >= 0),
  data_esperada   TEXT NOT NULL,
  data_recebida   TEXT,
  status          TEXT NOT NULL DEFAULT 'Esperado' CHECK (status IN ('Esperado', 'Recebido')),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Ou o recebimento vem de uma fonte recorrente, ou tem nome proprio.
  -- Nunca os dois, nunca nenhum: sem isto voltaria a existir recebimento
  -- sem como se chamar, que e o defeito que esta migration corrige.
  CHECK (
    (renda_id IS NOT NULL AND descricao IS NULL)
    OR (renda_id IS NULL AND descricao IS NOT NULL)
  )
);

-- O LEFT JOIN classifica cada linha existente em tres casos:
--   * ligada a fonte Avulsa  -> herda o nome dela e solta o vinculo
--   * ligada a fonte Recorrente -> intacta, continua herdando pelo JOIN
--   * ja sem fonte (nao deveria existir, mas o schema permitia) -> ganha um
--     nome generico, senao o CHECK novo rejeitaria a linha e a migration
--     abortaria por causa de dado legado que o app nunca soube criar
INSERT INTO recebimento_new (
  id, renda_id, descricao, valor_centavos, data_esperada, data_recebida, status, created_at, updated_at
)
SELECT
  r.id,
  CASE WHEN rd.tipo = 'Avulsa' THEN NULL ELSE r.renda_id END,
  CASE
    WHEN rd.tipo = 'Avulsa'  THEN rd.nome
    WHEN r.renda_id IS NULL  THEN 'Recebimento avulso'
    ELSE NULL
  END,
  r.valor_centavos,
  r.data_esperada,
  r.data_recebida,
  r.status,
  r.created_at,
  r.updated_at
FROM recebimento r
LEFT JOIN renda rd ON rd.id = r.renda_id;

DROP TABLE recebimento;
ALTER TABLE recebimento_new RENAME TO recebimento;

CREATE INDEX idx_recebimento_renda ON recebimento (renda_id);

-- (2) fontes Avulsa, agora sem recebimentos ---------------------------------

DELETE FROM renda WHERE tipo = 'Avulsa';

-- (3) renda so com Recorrente -----------------------------------------------

CREATE TABLE renda_new (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                  TEXT NOT NULL,
  tipo                  TEXT NOT NULL DEFAULT 'Recorrente' CHECK (tipo = 'Recorrente'),
  valor_padrao_centavos INTEGER NOT NULL CHECK (valor_padrao_centavos >= 0),
  dia_esperado          INTEGER NOT NULL CHECK (dia_esperado BETWEEN 1 AND 31),
  ativa                 INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  created_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Re-valida cada linha legada: renda Recorrente sem dia_esperado aborta aqui
-- em vez de ser arrastada adiante. O CHECK antigo ja exigia o dia para
-- Recorrente, entao nao deve existir nenhuma.
INSERT INTO renda_new (id, nome, tipo, valor_padrao_centavos, dia_esperado, ativa, created_at, updated_at)
  SELECT id, nome, tipo, valor_padrao_centavos, dia_esperado, ativa, created_at, updated_at FROM renda;

DROP TABLE renda;
ALTER TABLE renda_new RENAME TO renda;

COMMIT;

PRAGMA foreign_keys = ON;
