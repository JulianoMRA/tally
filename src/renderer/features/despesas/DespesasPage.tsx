import { useState } from 'react'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput,
  DespesaAssinaturaCreditoInput,
  DespesaUnicaForaCartaoInput
} from '@shared/ipc/despesa'
import { DespesaForm } from './DespesaForm'
import { useCartoesAtivos } from './hooks/use-cartoes-ativos'
import { useCategoriasDespesa } from './hooks/use-categorias-despesa'
import { PageHead } from '../../components/layout/PageHead'
import { useToast } from '../../components/ui'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import styles from './despesas.module.css'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
  parcelas?: number
  formaForaCartao?: 'Pix' | 'Debito' | 'Dinheiro'
}

export default function DespesasPage() {
  const { cartoes, loading: loadingCartoes } = useCartoesAtivos()
  const { categorias, loading: loadingCategorias } = useCategoriasDespesa()
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)
  const toast = useToast()

  async function handleSalvarUnica(input: DespesaUnicaCreditoInput) {
    try {
      const resultado = await window.api.despesa.criarUnicaCredito(input)
      const cartao = cartoes.find((c) => c.id === input.cartaoId)
      setUltimaRegistrada({
        descricao: resultado.despesa.descricao,
        mesReferencia: resultado.fatura.mesReferencia,
        cartaoNome: cartao?.nome ?? String(input.cartaoId)
      })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao registrar despesa.'), 'error')
    }
  }

  async function handleSalvarParcelada(input: DespesaParceladaCreditoInput) {
    try {
      const resultado = await window.api.despesa.criarParceladaCredito(input)
      const cartao = cartoes.find((c) => c.id === input.cartaoId)
      const primeiraParcela = resultado.parcelas[0]
      setUltimaRegistrada({
        descricao: resultado.despesa.descricao,
        mesReferencia: primeiraParcela?.dataReferencia ?? '—',
        cartaoNome: cartao?.nome ?? String(input.cartaoId),
        parcelas: resultado.parcelas.length
      })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao registrar despesa parcelada.'), 'error')
    }
  }

  async function handleSalvarEmAndamento(input: DespesaEmAndamentoInput) {
    try {
      const resultado = await window.api.despesa.criarParceladaEmAndamento(input)
      const cartao = cartoes.find((c) => c.id === input.cartaoId)
      const primeiraParcela = resultado.parcelas[0]
      setUltimaRegistrada({
        descricao: resultado.despesa.descricao,
        mesReferencia: primeiraParcela?.dataReferencia ?? '—',
        cartaoNome: cartao?.nome ?? String(input.cartaoId),
        parcelas: resultado.parcelas.length
      })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao registrar despesa em andamento.'), 'error')
    }
  }

  async function handleSalvarUnicaForaCartao(input: DespesaUnicaForaCartaoInput) {
    try {
      const resultado = await window.api.despesa.criarUnicaForaCartao(input)
      setUltimaRegistrada({
        descricao: resultado.despesa.descricao,
        mesReferencia: resultado.parcela.dataReferencia,
        cartaoNome: '—',
        formaForaCartao: input.formaPagamento
      })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao registrar gasto fora de cartão.'), 'error')
    }
  }

  async function handleSalvarAssinatura(input: DespesaAssinaturaCreditoInput) {
    try {
      const resultado = await window.api.despesa.criarAssinaturaCredito(input)
      const cartao = cartoes.find((c) => c.id === input.cartaoId)
      const primeira = resultado.parcelas[0]
      setUltimaRegistrada({
        descricao: resultado.despesa.descricao,
        mesReferencia: primeira?.dataReferencia ?? '—',
        cartaoNome: cartao?.nome ?? String(input.cartaoId),
        parcelas: resultado.parcelas.length
      })
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao registrar assinatura.'), 'error')
    }
  }

  const loading = loadingCartoes || loadingCategorias

  return (
    <div>
      <PageHead title="Nova despesa" subtitle="Registre um gasto no cartão ou fora dele." />

      <div className={styles.body}>
        {ultimaRegistrada && (
          <div className={styles.successBanner}>
            <strong>{ultimaRegistrada.descricao}</strong>
            {ultimaRegistrada.formaForaCartao ? (
              <>
                {' '}
                registrada via <strong>{ultimaRegistrada.formaForaCartao}</strong> em{' '}
                <strong>{formatarMesReferencia(ultimaRegistrada.mesReferencia)}</strong>.
              </>
            ) : (
              <>
                {ultimaRegistrada.parcelas
                  ? ` registrada com ${ultimaRegistrada.parcelas} parcelas a partir de `
                  : ' registrada na fatura '}
                <strong>{formatarMesReferencia(ultimaRegistrada.mesReferencia)}</strong> · cartão{' '}
                <strong>{ultimaRegistrada.cartaoNome}</strong>.
              </>
            )}
          </div>
        )}

        {!loading && (
          <DespesaForm
            cartoes={cartoes}
            categorias={categorias}
            onSalvarUnica={handleSalvarUnica}
            onSalvarUnicaForaCartao={handleSalvarUnicaForaCartao}
            onSalvarParcelada={handleSalvarParcelada}
            onSalvarEmAndamento={handleSalvarEmAndamento}
            onSalvarAssinatura={handleSalvarAssinatura}
          />
        )}
      </div>
    </div>
  )
}
