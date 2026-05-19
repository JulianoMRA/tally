import { useState } from 'react'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput
} from '@shared/ipc/despesa'
import { DespesaForm } from './DespesaForm'
import { useCartoesAtivos } from './hooks/use-cartoes-ativos'
import { useCategoriasDespesa } from './hooks/use-categorias-despesa'
import { PageHead } from '../../components/layout/PageHead'
import styles from './despesas.module.css'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
  parcelas?: number
}

export default function DespesasPage() {
  const { cartoes, loading: loadingCartoes } = useCartoesAtivos()
  const { categorias, loading: loadingCategorias } = useCategoriasDespesa()
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)

  async function handleSalvarUnica(input: DespesaUnicaCreditoInput) {
    const resultado = await window.api.despesa.criarUnicaCredito(input)
    const cartao = cartoes.find((c) => c.id === input.cartaoId)
    setUltimaRegistrada({
      descricao: resultado.despesa.descricao,
      mesReferencia: resultado.fatura.mesReferencia,
      cartaoNome: cartao?.nome ?? String(input.cartaoId)
    })
  }

  async function handleSalvarParcelada(input: DespesaParceladaCreditoInput) {
    const resultado = await window.api.despesa.criarParceladaCredito(input)
    const cartao = cartoes.find((c) => c.id === input.cartaoId)
    const primeiraParcela = resultado.parcelas[0]
    setUltimaRegistrada({
      descricao: resultado.despesa.descricao,
      mesReferencia: primeiraParcela?.dataReferencia ?? '—',
      cartaoNome: cartao?.nome ?? String(input.cartaoId),
      parcelas: resultado.parcelas.length
    })
  }

  async function handleSalvarEmAndamento(input: DespesaEmAndamentoInput) {
    const resultado = await window.api.despesa.criarParceladaEmAndamento(input)
    const cartao = cartoes.find((c) => c.id === input.cartaoId)
    const primeiraParcela = resultado.parcelas[0]
    setUltimaRegistrada({
      descricao: resultado.despesa.descricao,
      mesReferencia: primeiraParcela?.dataReferencia ?? '—',
      cartaoNome: cartao?.nome ?? String(input.cartaoId),
      parcelas: resultado.parcelas.length
    })
  }

  const loading = loadingCartoes || loadingCategorias

  return (
    <div>
      <PageHead title="Nova despesa" subtitle="Registre um gasto no cartão de crédito." />

      <div className={styles.body}>
        {ultimaRegistrada && (
          <div className={styles.successBanner}>
            <strong>{ultimaRegistrada.descricao}</strong>
            {ultimaRegistrada.parcelas
              ? ` registrada com ${ultimaRegistrada.parcelas} parcelas a partir de `
              : ' registrada na fatura '}
            <strong>{ultimaRegistrada.mesReferencia}</strong> · cartão{' '}
            <strong>{ultimaRegistrada.cartaoNome}</strong>.
          </div>
        )}

        {!loading && (
          <DespesaForm
            cartoes={cartoes}
            categorias={categorias}
            onSalvarUnica={handleSalvarUnica}
            onSalvarParcelada={handleSalvarParcelada}
            onSalvarEmAndamento={handleSalvarEmAndamento}
          />
        )}
      </div>
    </div>
  )
}
