-- Slice 15 — normaliza parcela.data_referencia para sempre YYYY-MM-DD.
--
-- Historicamente a coluna aceitava dois formatos:
--   * YYYY-MM-DD para parcelas Unica (criarUnicaCredito / criarUnicaForaCartao)
--   * YYYY-MM para parcelas Parcelada / Assinatura (saida de gerar-parcelas e
--     gerar-ocorrencias-assinatura, que retornavam apenas o mes de referencia)
--
-- Slice 15 alinhou o codigo: ambos os geradores agora emitem YYYY-MM-DD
-- (dia 01 quando deriva de mes de referencia). Este backfill traz os dados
-- ja persistidos para o novo formato — sufixa "-01" em qualquer registro
-- que tenha length=7 (formato antigo YYYY-MM).

UPDATE parcela
SET data_referencia = data_referencia || '-01'
WHERE length(data_referencia) = 7;
