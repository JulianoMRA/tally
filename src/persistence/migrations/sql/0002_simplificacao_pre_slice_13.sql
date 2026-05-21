-- Slice 12.1 — simplificacao pre-Slice 13.
--
-- Remove tabelas ajuda e contribuidor (decisao de produto: cobrancas a
-- terceiros viram rendas avulsas). Essas tabelas nao tem FKs incoming,
-- entao o DROP e seguro mesmo com foreign_keys = ON.
--
-- NOTA: as colunas categoria.icone e renda.categoria_id permanecem no
-- schema como colunas mortas. O codigo nao as referencia mais, e os INSERTs
-- omitem essas colunas (ambas sao nullable). Uma migration futura pode
-- limpar essas colunas via recreate-table pattern, mas isso requer
-- desligar foreign_keys fora da transacao do runner — refator infra que
-- fica para um slice de hardening posterior.

DROP INDEX IF EXISTS idx_ajuda_parcela;
DROP INDEX IF EXISTS idx_ajuda_contribuidor;
DROP TABLE IF EXISTS ajuda;
DROP TABLE IF EXISTS contribuidor;
