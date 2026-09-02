-- Correção (set/2026) — o adiantamento de parcelas desfazia o backfill da 0010.
--
-- A 0010 estabeleceu o invariante: parcela COM fatura tem
-- `data_referencia = fatura.mes_referencia || '-01'`. O `adiantar` do
-- ParcelaRepository trocava só o `fatura_id` e deixava a coluna no mês antigo,
-- então cada adiantamento reintroduzia, naquelas linhas, exatamente a
-- divergência que a 0010 existe para eliminar — a mesma parcela em um mês pela
-- fatura e em outro pela parcela.
--
-- O sintoma visível era a exportação de CSV: `montarLinhasDoMes` lê as
-- parcelas pela fatura do mês mas imprime `parcela.data_referencia` na coluna
-- `data`, então o CSV de fevereiro saía com linhas datadas de junho e julho.
--
-- O código já foi corrigido (o UPDATE agora move `data_referencia` junto).
-- Esta migration traz de volta as linhas que o bug já deixou divergentes.
-- É o mesmo backfill da 0010, reaplicado: idempotente, e no-op num banco que
-- nunca usou adiantamento.
--
-- Escopo idêntico ao da 0010: só parcelas COM fatura. Gasto fora do cartão
-- (fatura_id NULL) continua com a data da compra em `data_referencia` — é a
-- única referência de mês que ele possui.

UPDATE parcela
SET
  data_referencia = (
    SELECT fatura.mes_referencia || '-01'
    FROM fatura
    WHERE fatura.id = parcela.fatura_id
  ),
  updated_at = datetime('now')
WHERE
  fatura_id IS NOT NULL
  AND data_referencia <> (
    SELECT fatura.mes_referencia || '-01'
    FROM fatura
    WHERE fatura.id = parcela.fatura_id
  );
