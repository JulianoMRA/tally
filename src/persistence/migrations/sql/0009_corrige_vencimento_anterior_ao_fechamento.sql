-- Correção (ago/2026) — faturas com vencimento anterior ao próprio fechamento.
--
-- `upsertParaCompra`/`upsertParaMesReferencia` calculavam fechamento e
-- vencimento sempre no mesmo mês de referência. Isso só está certo quando o dia
-- de vencimento é posterior ao de fechamento (Inter F=05/V=12, Nubank
-- F=15/V=22). Em um cartão que fecha dia 24 e vence dia 01, a fatura de agosto
-- ficava com fechamento 24/08 e vencimento 01/08 — 23 dias antes de fechar.
--
-- Consequências nos dados gravados: a fatura nascia vencida no instante do
-- fechamento, a janela `Fechada` de RN-06 (`data_fechamento <= hoje <
-- data_vencimento`) ficava vazia e o aviso de vencimento próximo nunca
-- disparava para esses cartões.
--
-- O domínio passou a calcular o vencimento no mês seguinte quando V < F
-- (`calcularDatasDaFatura`). Esta migration alinha as faturas já gravadas.
--
-- O filtro é a inconsistência em si (`data_vencimento < data_fechamento`), não
-- a configuração do cartão: só toca no que está de fato quebrado e ignora
-- faturas onde o clamp de fim de mês igualou as duas datas.
--
-- O novo vencimento é o dia de vencimento do cartão no mês seguinte ao mês de
-- referência, clamped ao último dia desse mês — mesma regra do domínio. O
-- `min(...)` faz o clamp: sem ele, '+30 days' sobre fevereiro transbordaria
-- para março.

UPDATE fatura
SET data_vencimento = min(
      date(
        mes_referencia || '-01',
        '+1 month',
        '+' || (SELECT c.dia_vencimento - 1 FROM cartao c WHERE c.id = fatura.cartao_id) || ' days'
      ),
      date(mes_referencia || '-01', '+2 months', '-1 day')
    ),
    updated_at = datetime('now')
WHERE data_vencimento < data_fechamento;
