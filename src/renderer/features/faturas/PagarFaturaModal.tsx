import { useState } from 'react'
import { hojeIsoLocal } from '@shared/datas-locais'
import { dataIsoSchema } from '@shared/ipc/date-schema'
import { Button, Field, Input, Modal } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarMesReferencia } from '../../lib/formatar-data'
import styles from './faturas.module.css'

type Props = {
  cartaoNome: string
  mesReferencia: string
  totalCentavos: number
  /** RN-10 — o que já foi pago em parciais, e o que falta: é o que se paga aqui. */
  pagoParcialCentavos: number
  restanteCentavos: number
  loading: boolean
  /** Erro do último pagamento: fica no diálogo, que só fecha quando der certo. */
  erro: string | null
  onConfirmar: (dataPagamento: string) => void
  onCancelar: () => void
}

/**
 * Marcar a fatura como paga (RF-FAT-04). A confirmação que o requisito pede é
 * este diálogo, como já eram as de fechar e reabrir.
 *
 * Era um formulário inline no card de resumo, o único passo do ciclo fora de
 * um diálogo. Com a data apagada, "Confirmar pagamento" mandava uma string
 * vazia ao main, e o card mostrava o JSON do zod: aqui o botão só habilita com
 * uma data que existe no calendário — a mesma validação do main.
 *
 * Com pagamento parcial (RN-10), o que se paga aqui é o restante, e o diálogo
 * diz isso: mostrando só o total, confirmar parecia pagar de novo o que já
 * tinha sido pago.
 */
export function PagarFaturaModal({
  cartaoNome,
  mesReferencia,
  totalCentavos,
  pagoParcialCentavos,
  restanteCentavos,
  loading,
  erro,
  onConfirmar,
  onCancelar
}: Props) {
  const [dataPagamento, setDataPagamento] = useState(hojeIsoLocal)
  const dataValida = dataIsoSchema.safeParse(dataPagamento).success

  return (
    <Modal
      titulo="Marcar fatura como paga"
      descricao={
        <>
          <strong>
            {cartaoNome} · {formatarMesReferencia(mesReferencia, { capitalizar: true })}
          </strong>{' '}
          —{' '}
          {pagoParcialCentavos > 0
            ? `falta pagar ${formatBRL(restanteCentavos)} de ${formatBRL(totalCentavos)} (${formatBRL(pagoParcialCentavos)} já pagos em parciais)`
            : formatBRL(totalCentavos)}
          . As parcelas dela ficam pagas com a mesma data.
        </>
      }
      onFechar={onCancelar}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onConfirmar(dataPagamento)}
            disabled={loading || !dataValida}
          >
            {loading ? 'Pagando…' : 'Confirmar pagamento'}
          </Button>
        </>
      }
    >
      {/* Mesmo rótulo e mesma mensagem do diálogo de pagamento parcial. Este
          dizia "Data de pagamento" e, com a data apagada, só desabilitava o
          botão, sem dizer o que estava errado. */}
      <Field label="Data do pagamento" error={dataValida ? undefined : 'Data inválida.'}>
        <Input
          type="date"
          value={dataPagamento}
          onChange={(e) => setDataPagamento(e.target.value)}
          error={!dataValida}
        />
      </Field>

      {erro && <p className={styles.erroAcao}>{erro}</p>}
    </Modal>
  )
}
