import type { ReactNode } from 'react'
import type { Despesa } from '@domain/entities/despesa'
import { ConfirmDialog } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { pluralizar } from '../../lib/pluralizar'

/**
 * O que o diálogo de exclusão diz da despesa: descrição, valor e, conforme o
 * tipo, em quantas parcelas ou por mês. Era genérico — "A despesa e TODAS as
 * suas parcelas pendentes serão removidas" —, numa tabela densa e para uma ação
 * irreversível, enquanto o de excluir pagamento parcial já repetia valor e data.
 */
function textoDaExclusao(despesa: Despesa | undefined): ReactNode {
  const irreversivel = 'Esta ação é irreversível.'
  if (!despesa) return `A despesa e todas as parcelas dela serão removidas. ${irreversivel}`

  const nome = <strong>{despesa.descricao}</strong>
  const valor = formatBRL(despesa.valorCentavos)
  switch (despesa.tipo) {
    case 'Unica':
      return (
        <>
          {nome}, {valor}. {irreversivel}
        </>
      )
    case 'Parcelada': {
      const total = despesa.totalParcelas
      const quantas = total ? ` em ${total} ${pluralizar('parcela', total)}` : ''
      return (
        <>
          {nome}, {valor}
          {quantas}. Todas as parcelas dela serão removidas. {irreversivel}
        </>
      )
    }
    case 'Assinatura':
      return (
        <>
          {nome}, {valor} por mês. Todas as ocorrências dela serão removidas. {irreversivel}
        </>
      )
  }
}

type DialogoExcluirDespesaProps = {
  /** Sem a despesa, o texto cai no genérico, sem nome nem valor. */
  despesa: Despesa | undefined
  onConfirmar: () => void
  onCancelar: () => void
}

/** A confirmação de excluir uma despesa, a mesma em Saídas e em Faturas (RF-DES-09). */
export function DialogoExcluirDespesa({
  despesa,
  onConfirmar,
  onCancelar
}: DialogoExcluirDespesaProps) {
  return (
    <ConfirmDialog
      title="Excluir despesa?"
      body={textoDaExclusao(despesa)}
      confirmText="Excluir"
      confirmVariant="danger"
      onConfirm={onConfirmar}
      onCancel={onCancelar}
    />
  )
}
