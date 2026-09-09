-- @no-transaction
-- RF-CAT-01 — remove `categoria.tipo`.
--
-- A coluna nasceu para separar categorias de despesa das de renda. O Slice 12.1
-- removeu `renda.categoria_id`, e desde entao renda nao tem categoria: os tres
-- unicos chamadores de `categoria.list({ tipo })` no app pedem 'Despesa'.
-- Ninguem jamais pede 'Renda'.
--
-- O efeito era pior do que uma coluna sem uso. O formulario oferecia 'Renda' e
-- 'Ambos', e uma categoria criada como 'Renda' era INALCANCAVEL em todo o app:
-- nao aparecia no cadastro de despesa (filtrado por 'Despesa'), e renda nao tem
-- onde exibi-la. O campo deixava gravar um registro garantidamente inerte.
--
-- Precedente do proprio projeto: a 0003 dropou `categoria.icone` e
-- `renda.categoria_id` pelo mesmo motivo, com este mesmo pattern. Aqui nao ha
-- conversao de dado a fazer — a coluna inteira sai, e as categorias que existem
-- continuam valendo para despesa, que e o unico uso que ja tinham.
--
-- Usa recreate-table. `PRAGMA defer_foreign_keys` NAO basta: ele adia a
-- checagem de violacoes, nao permite DROP de tabela referenciada por FK ativa
-- (despesa->categoria, orcamento->categoria). Desligar `foreign_keys` so
-- funciona em autocommit, dai a diretiva `@no-transaction` no header, que faz o
-- runner pular o wrapper `db.transaction()`.

PRAGMA foreign_keys = OFF;

BEGIN;

CREATE TABLE categoria_new (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL,
  cor         TEXT NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categoria_new (id, nome, cor, ativo, created_at, updated_at)
  SELECT id, nome, cor, ativo, created_at, updated_at FROM categoria;

DROP TABLE categoria;
ALTER TABLE categoria_new RENAME TO categoria;

COMMIT;

PRAGMA foreign_keys = ON;
