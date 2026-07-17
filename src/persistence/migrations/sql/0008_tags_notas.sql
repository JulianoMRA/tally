-- Fase 11 (jul/2026) — notas livres e tags nas despesas.
--
-- `despesa.nota`: texto livre opcional (NULL = sem nota). ADD COLUMN é aditivo
-- e não exige rebuild.
--
-- `tag` / `despesa_tag`: relação N:N. Nome de tag único case-insensitive
-- (COLLATE NOCASE). CASCADE nos dois lados: apagar a despesa remove os
-- vínculos (a tag permanece, compartilhável); apagar a tag remove os vínculos.
-- Migration transacional padrão (sem @no-transaction): só cria estruturas
-- novas e uma coluna, sem DROP de tabela referenciada.

ALTER TABLE despesa ADD COLUMN nota TEXT;

CREATE TABLE tag (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE despesa_tag (
  despesa_id  INTEGER NOT NULL REFERENCES despesa(id) ON DELETE CASCADE,
  tag_id      INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (despesa_id, tag_id)
);

CREATE INDEX idx_despesa_tag_tag ON despesa_tag (tag_id);
