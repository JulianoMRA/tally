import { useState } from 'react'
import type { RecebimentoComContexto } from '@shared/ipc/recebimento'
import { hojeIsoLocal } from '@shared/datas-locais'
import { Button, Field, Input, SidePanel } from '../../components/ui'
import { centavosParaReais, ehValorValido, parseCentavos } from '../../lib/dinheiro'
import styles from './rendas.module.css'

export type DadosAvulso = {
  descricao: string
  valorCentavos: number
  dataEsperada: string
  dataRecebida?: string
}

type Props = {
  onConfirmar: (input: DadosAvulso) => Promise<void>
  onCancelar: () => void
  /** Quando presente, o painel edita esta entrada em vez de criar uma nova. */
  inicial?: RecebimentoComContexto
}

/**
 * Cria ou edita uma entrada avulsa.
 *
 * Nao ha seletor de fonte: desde a migration 0011 entrada avulsa nao tem fonte.
 * Antes ele existia porque `recebimento` nao tinha coluna de nome — sem uma
 * `renda` por tras, o avulso ficava sem como se chamar —, e o seletor era o
 * remendo para nao criar uma fonte nova a cada freela do mesmo cliente.
 *
 * O mesmo painel serve os dois modos porque os campos sao exatamente os mesmos.
 * Duplica-lo custaria mais uma copia do par regex/parse de valor, que ja tem
 * copias demais no renderer.
 */
export function AvulsoPanel({ onConfirmar, onCancelar, inicial }: Props) {
  const ehEdicao = inicial !== undefined

  const [descricao, setDescricao] = useState(inicial?.nome ?? '')
  const [valorReais, setValorReais] = useState(
    inicial ? centavosParaReais(inicial.valorCentavos) : ''
  )
  const [dataEsperada, setDataEsperada] = useState(inicial?.dataEsperada ?? hojeIsoLocal)
  const [jaRecebido, setJaRecebido] = useState(inicial ? inicial.dataRecebida !== null : true)
  const [dataRecebida, setDataRecebida] = useState(inicial?.dataRecebida ?? hojeIsoLocal())
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirmar() {
    if (!descricao.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
    if (!ehValorValido(valorReais)) {
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
      await onConfirmar({
        descricao: descricao.trim(),
        valorCentavos: centavos,
        dataEsperada,
        dataRecebida: jaRecebido ? dataRecebida : undefined
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar recebimento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SidePanel
      titulo={ehEdicao ? 'Editar entrada avulsa' : 'Nova entrada avulsa'}
      descricao="Entrada sem fonte recorrente: freela, presente, venda, reembolso."
      onFechar={onCancelar}
      // Formulário com dado digitado: clique fora não descarta.
      fecharNoOverlay={false}
      rodape={
        <>
          <Button variant="ghost" size="sm" onClick={onCancelar} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirmar} disabled={loading}>
            {loading ? 'Salvando…' : ehEdicao ? 'Salvar' : 'Registrar'}
          </Button>
        </>
      }
    >
      <Field label="Descrição">
        <Input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: Freela do cliente X"
          autoFocus
        />
      </Field>

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
