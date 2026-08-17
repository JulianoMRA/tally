import type { Cartao } from '@domain/entities/cartao'
import {
  calcularReferenciaFaturaDaCompra,
  formatarMesReferencia as formatarRefFatura
} from '@domain/services/calcular-fatura-da-compra'
import { formatarMesReferencia } from '../../lib/formatar-data'
import styles from './despesas.module.css'

type Props = {
  cartoes: Cartao[]
  cartaoId: string | number | undefined
  dataCompra: string | undefined
  /** Rótulo do que vai cair: "Esta compra", "A 1ª parcela", "A mensalidade". */
  sujeito?: string
}

/**
 * Mostra em qual fatura o lançamento vai cair, antes de salvar.
 *
 * Aplica o RN-01 na hora da digitação. Hoje só se descobre o destino depois de
 * salvar e navegar até Faturas, e é por isso que lançar no cartão errado — ou
 * no mês errado, quando a compra é feita depois do fechamento — só aparece
 * bem mais tarde.
 */
export function PreviaDestino({ cartoes, cartaoId, dataCompra, sujeito = 'Esta compra' }: Props) {
  const id = Number(cartaoId)
  const cartao = Number.isFinite(id) ? cartoes.find((c) => c.id === id) : undefined
  if (!cartao || !dataCompra) return null

  let mesReferencia: string
  try {
    mesReferencia = formatarRefFatura(
      calcularReferenciaFaturaDaCompra(dataCompra, cartao.diaFechamento)
    )
  } catch {
    // Data ainda incompleta enquanto se digita: some em vez de piscar erro.
    return null
  }

  return (
    <p className={styles.previaDestino}>
      <span className={styles.previaRotulo}>Vai cair em</span>
      {sujeito} entra na fatura de <strong>{formatarMesReferencia(mesReferencia)}</strong> do{' '}
      <strong>{cartao.nome}</strong>, que fecha dia {cartao.diaFechamento} e vence dia{' '}
      {cartao.diaVencimento}.
    </p>
  )
}
