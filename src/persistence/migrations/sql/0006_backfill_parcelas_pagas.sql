-- PR integridade — backfill de parcelas em faturas já Pagas.
--
-- Até aqui nenhum fluxo de produção marcava parcela.status = 'Paga': pagar a
-- fatura atualizava apenas a própria fatura. As regras RF-DES-09/10 (bloqueio
-- de exclusão/edição com parcela paga) dependiam desse status e nunca
-- disparavam, permitindo reescrever histórico de faturas Pagas (viola RN-06).
--
-- A partir desta versão FaturaRepository.pagar/reabrir sincronizam as parcelas;
-- esta migration alinha os dados pré-existentes: toda parcela Pendente dentro
-- de fatura Paga recebe status Paga com a data de pagamento da fatura.

UPDATE parcela
SET status = 'Paga',
    data_pagamento = (SELECT f.data_pagamento FROM fatura f WHERE f.id = parcela.fatura_id),
    updated_at = datetime('now')
WHERE status = 'Pendente'
  AND fatura_id IN (SELECT id FROM fatura WHERE status = 'Paga');
