-- Correção (ago/2026) — parcela.data_referencia de compra única no crédito
-- guardava a data da compra, não o mês da fatura.
--
-- O 0004 alinhou o FORMATO da coluna (sempre YYYY-MM-DD). O SIGNIFICADO seguiu
-- dividido: `criarParceladaCredito`, `criarParceladaEmAndamento` e
-- `criarAssinaturaCredito` gravam o mês de referência da fatura (dia 01, via
-- `gerarParcelas`), enquanto `criarUnicaCredito` gravava `input.dataCompra`.
--
-- Pelo RN-01 uma compra feita a partir do dia de fechamento pertence à fatura
-- do mês seguinte. Com a data da compra na parcela, a mesma despesa ficava em
-- um mês quando a consulta olhava `parcela.data_referencia` e em outro quando
-- olhava `fatura.mes_referencia` — uma compra de 28/06 num cartão que fecha
-- dia 5 aparecia em junho pela parcela e em julho pela fatura.
--
-- O código passou a gravar o mês da fatura nos dois caminhos (criação e
-- edição de data em RF-DES-10). Este backfill traz as linhas já persistidas.
--
-- Escopo: só parcelas COM fatura. Gasto fora do cartão (fatura_id NULL) não
-- tem fatura e continua com a data da compra em data_referencia — é a única
-- referência de mês que ele possui, e os relatórios agrupam por ela.

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
