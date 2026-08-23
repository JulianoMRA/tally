import { useEffect, useState } from 'react'
import type { Fatura } from '@domain/entities/fatura'
import { Button, Field, Input, Modal, Select } from '../../components/ui'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import styles from './faturas.module.css'

type Props = {
  despesaId: number
  descricao: string
  cartaoId: number
  faturaAtualId: number
  onConfirmar: (despesaId: number, quantidade: number, faturaDestinoId: number) => Promise<void>
  onCancelar: () => void
}

export function AdiantarParcelasModal({
  despesaId,
  descricao,
  cartaoId,
  faturaAtualId,
  onConfirmar,
  onCancelar
}: Props) {
  const [quantidade, setQuantidade] = useState('1')
  const [faturaDestinoId, setFaturaDestinoId] = useState<string>('')
  const [faturasDestino, setFaturasDestino] = useState<Fatura[]>([])
  const [loadingFaturas, setLoadingFaturas] = useState(true)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    window.api.fatura
      .listarPorCartao(cartaoId)
      .then((todas) => {
        if (!ativo) return
        const candidatas = todas.filter((f) => f.id !== faturaAtualId && f.status.kind === 'Aberta')
        setFaturasDestino(candidatas)
        if (candidatas.length > 0) setFaturaDestinoId(String(candidatas[0].id))
      })
      .catch((e) => {
        if (!ativo) return
        setErro(e instanceof Error ? e.message : 'Erro ao carregar faturas destino.')
      })
      .finally(() => {
        if (ativo) setLoadingFaturas(false)
      })
    return () => {
      ativo = false
    }
  }, [cartaoId, faturaAtualId])

  async function handleConfirmar() {
    const qtd = parseInt(quantidade, 10)
    const destino = parseInt(faturaDestinoId, 10)
    if (isNaN(qtd) || qtd <= 0) {
      setErro('Quantidade deve ser maior que zero.')
      return
    }
    if (isNaN(destino) || destino <= 0) {
      setErro('Selecione a fatura destino.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar(despesaId, qtd, destino)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao adiantar parcelas.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      titulo="Adiantar parcelas"
      descricao={
        <>
          Despesa: <strong>{descricao}</strong>. As parcelas mais futuras serão movidas para a
          fatura destino.
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
            onClick={handleConfirmar}
            disabled={loading || faturasDestino.length === 0}
          >
            {loading ? 'Adiantando…' : 'Confirmar'}
          </Button>
        </>
      }
    >
      <div className={styles.modalFields}>
        <Field label="Fatura destino">
          <Select
            value={faturaDestinoId}
            onChange={(e) => setFaturaDestinoId(e.target.value)}
            disabled={loadingFaturas || faturasDestino.length === 0}
          >
            {loadingFaturas ? (
              <option value="">Carregando…</option>
            ) : faturasDestino.length === 0 ? (
              <option value="">Nenhuma fatura Aberta disponível</option>
            ) : (
              faturasDestino.map((f) => (
                <option key={f.id} value={f.id}>
                  {formatarMesReferencia(f.mesReferencia, { capitalizar: true })} (vence{' '}
                  {formatarDataIso(f.dataVencimento)})
                </option>
              ))
            )}
          </Select>
        </Field>

        <Field label="Quantidade de parcelas">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </Field>
      </div>

      {erro && <p className={styles.erroAcao}>{erro}</p>}
    </Modal>
  )
}
