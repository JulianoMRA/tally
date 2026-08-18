import { useState } from 'react'
import type { Renda } from '@domain/entities/renda'
import type { CriarRecebimentoAvulsoInput } from '@shared/ipc/recebimento'
import { hojeIsoLocal } from '@shared/datas-locais'
import { Button, Field, Input, Select, SidePanel } from '../../components/ui'
import styles from './rendas.module.css'

type Props = {
  onConfirmar: (input: CriarRecebimentoAvulsoInput) => Promise<void>
  onCancelar: () => void
  /** Fontes avulsas já cadastradas, para reaproveitar em vez de duplicar. */
  fontes: Renda[]
}

const FONTE_NOVA = 'nova'

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

export function NovoAvulsoPanel({ onConfirmar, onCancelar, fontes }: Props) {
  const [fonteId, setFonteId] = useState<string>(FONTE_NOVA)
  const [nome, setNome] = useState('')
  const [valorReais, setValorReais] = useState('')
  const [dataEsperada, setDataEsperada] = useState(hojeIsoLocal)
  const [jaRecebido, setJaRecebido] = useState(true)
  const [dataRecebida, setDataRecebida] = useState(hojeIsoLocal)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const ehFonteNova = fonteId === FONTE_NOVA

  async function handleConfirmar() {
    if (ehFonteNova && !nome.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
    if (!/^\d+([.,]\d{1,2})?$/.test(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const centavos = parseCentavos(valorReais)
    if (centavos <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      const comum = {
        valorCentavos: centavos,
        dataEsperada,
        dataRecebida: jaRecebido ? dataRecebida : undefined
      }
      // Fonte existente reusa o vínculo; só "nova fonte" cria uma renda. Antes
      // todo avulso criava uma, e três freelas do mesmo cliente viravam três
      // fontes idênticas na aba Fontes.
      await onConfirmar(
        ehFonteNova ? { nome: nome.trim(), ...comum } : { rendaId: Number(fonteId), ...comum }
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar recebimento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SidePanel
      titulo="Novo recebimento avulso"
      descricao="Para entradas sem fonte recorrente: freela, presente, venda etc."
      onFechar={onCancelar}
      // Formulário com dado digitado: clique fora não descarta.
      fecharNoOverlay={false}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : 'Registrar'}
          </Button>
        </>
      }
    >
      <Field label="Fonte">
        <Select value={fonteId} onChange={(e) => setFonteId(e.target.value)} autoFocus>
          <option value={FONTE_NOVA}>— nova fonte —</option>
          {fontes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </Select>
      </Field>

      {ehFonteNova && (
        <Field label="Descrição">
          <Input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Freela X"
          />
        </Field>
      )}

      <div className={styles.modalRow}>
        <Field label="Valor (R$)">
          <Input
            type="text"
            inputMode="decimal"
            value={valorReais}
            onChange={(e) => setValorReais(e.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Data esperada">
          <Input
            type="date"
            value={dataEsperada}
            onChange={(e) => setDataEsperada(e.target.value)}
          />
        </Field>
      </div>

      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={jaRecebido}
          onChange={(e) => setJaRecebido(e.target.checked)}
        />
        Já recebi
      </label>

      {jaRecebido && (
        <Field label="Data recebida">
          <Input
            type="date"
            value={dataRecebida}
            onChange={(e) => setDataRecebida(e.target.value)}
          />
        </Field>
      )}

      {erro && <p className={styles.erro}>{erro}</p>}
    </SidePanel>
  )
}
