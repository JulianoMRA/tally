import { useEffect, useState } from 'react'
import type { Renda } from '@domain/entities/renda'
import { Button, Field, Input, Modal } from '../../components/ui'
import styles from './rendas.module.css'

type Props = {
  renda: Renda
  onConfirmar: (input: {
    nome: string
    valorPadraoCentavos: number
    diaEsperado?: number | null
  }) => Promise<void>
  onCancelar: () => void
}

function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

export function EditarRendaModal({ renda, onConfirmar, onCancelar }: Props) {
  const [nome, setNome] = useState(renda.nome)
  const [valorReais, setValorReais] = useState(centavosParaReais(renda.valorPadraoCentavos))
  const [diaEsperado, setDiaEsperado] = useState(
    renda.diaEsperado !== null ? String(renda.diaEsperado) : ''
  )
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    setNome(renda.nome)
    setValorReais(centavosParaReais(renda.valorPadraoCentavos))
    setDiaEsperado(renda.diaEsperado !== null ? String(renda.diaEsperado) : '')
  }, [renda])

  const ehRecorrente = renda.tipo === 'Recorrente'

  async function handleConfirmar() {
    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }
    if (!/^\d+([.,]\d{1,2})?$/.test(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const valorPadraoCentavos = parseCentavos(valorReais)
    if (valorPadraoCentavos <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    let diaNum: number | undefined
    if (ehRecorrente) {
      diaNum = parseInt(diaEsperado, 10)
      if (isNaN(diaNum) || diaNum < 1 || diaNum > 31) {
        setErro('Dia esperado deve ser entre 1 e 31.')
        return
      }
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar({
        nome: nome.trim(),
        valorPadraoCentavos,
        diaEsperado: ehRecorrente ? diaNum : undefined
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      titulo="Editar renda"
      descricao={
        <>
          Tipo: <strong>{renda.tipo}</strong>.{' '}
          {ehRecorrente
            ? 'Mudar valor ou dia ajusta recebimentos futuros (Esperado). Recebidos preservam.'
            : 'Edição direta.'}
        </>
      }
      onFechar={onCancelar}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : 'Salvar'}
          </Button>
        </>
      }
    >
      <Field label="Nome">
        <Input type="text" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </Field>

      <div className={styles.modalRow}>
        <Field label="Valor (R$)">
          <Input
            type="text"
            inputMode="decimal"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
          />
        </Field>

        {ehRecorrente && (
          <Field label="Dia esperado">
            <Input
              type="number"
              min={1}
              max={31}
              value={diaEsperado}
              onChange={(e) => setDiaEsperado(e.target.value)}
            />
          </Field>
        )}
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}
    </Modal>
  )
}
