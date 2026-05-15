import { useState } from 'react'
import type { DespesaUnicaCreditoInput } from '@shared/ipc/despesa'
import { DespesaForm } from './DespesaForm'
import { useCartoesAtivos } from './hooks/use-cartoes-ativos'
import { useCategoriasDespesa } from './hooks/use-categorias-despesa'
import { PageHead } from '../../components/layout/PageHead'
import styles from './despesas.module.css'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
}

export default function DespesasPage() {
  const { cartoes, loading: loadingCartoes } = useCartoesAtivos()
  const { categorias, loading: loadingCategorias } = useCategoriasDespesa()
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)

  async function handleSalvar(input: DespesaUnicaCreditoInput) {
    const resultado = await window.api.despesa.criarUnicaCredito(input)
    const cartao = cartoes.find((c) => c.id === input.cartaoId)
    setUltimaRegistrada({
      descricao: resultado.despesa.descricao,
      mesReferencia: resultado.fatura.mesReferencia,
      cartaoNome: cartao?.nome ?? String(input.cartaoId)
    })
  }

  const loading = loadingCartoes || loadingCategorias

  return (
    <div>
      <PageHead title="Nova despesa" subtitle="Registre um gasto avulso no cartão de crédito." />

      <div className={styles.body}>
        {ultimaRegistrada && (
          <div className={styles.successBanner}>
            <strong>{ultimaRegistrada.descricao}</strong> registrada na fatura{' '}
            <strong>{ultimaRegistrada.mesReferencia}</strong> do cartão{' '}
            <strong>{ultimaRegistrada.cartaoNome}</strong>.
          </div>
        )}

        {!loading && (
          <DespesaForm cartoes={cartoes} categorias={categorias} onSalvar={handleSalvar} />
        )}
      </div>
    </div>
  )
}
