import { useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import { Button, Field, Input, Modal, SegmentedControl, Select } from '../../components/ui'
import type { OpcaoSegmentada } from '../../components/ui'
import { centavosParaReais, ehValorValido, parseCentavos } from '../../lib/dinheiro'
import styles from './assinaturas.module.css'

type Props = {
  assinatura: Despesa
  categorias: Categoria[]
  onConfirmar: (input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) => Promise<void>
  /** RF-DES-19 — so existe para recorrente SEM cartao; ausente na de credito. */
  onAlterarLimite?: (recorreAte: string | null) => Promise<void>
  onCancelar: () => void
}

const DURACOES: readonly OpcaoSegmentada<'sempre' | 'ate'>[] = [
  { valor: 'sempre', rotulo: 'Sempre' },
  { valor: 'ate', rotulo: 'Até uma data' }
]

export function EditarAssinaturaModal({
  assinatura,
  categorias,
  onConfirmar,
  onAlterarLimite,
  onCancelar
}: Props) {
  const [descricao, setDescricao] = useState(assinatura.descricao)
  const [categoriaId, setCategoriaId] = useState(String(assinatura.categoriaId))
  const [valorReais, setValorReais] = useState(centavosParaReais(assinatura.valorCentavos))
  const [duracao, setDuracao] = useState<'sempre' | 'ate'>(assinatura.recorreAte ? 'ate' : 'sempre')
  const [recorreAte, setRecorreAte] = useState(assinatura.recorreAte ?? '')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const editaLimite = typeof onAlterarLimite === 'function'
  const limiteAlvo = duracao === 'ate' ? recorreAte : null

  async function handleConfirmar() {
    if (!descricao.trim()) {
      setErro('Descrição é obrigatória.')
      return
    }
    if (!ehValorValido(valorReais)) {
      setErro('Valor inválido.')
      return
    }
    const valorCentavos = parseCentavos(valorReais)
    if (valorCentavos <= 0) {
      setErro('Valor deve ser maior que zero.')
      return
    }
    if (editaLimite && duracao === 'ate' && !recorreAte) {
      setErro('Informe a data limite.')
      return
    }
    setErro(null)
    setLoading(true)
    try {
      await onConfirmar({
        descricao: descricao.trim(),
        categoriaId: Number(categoriaId),
        valorCentavos
      })
      // Depois do valor, e so quando mudou: alterar o limite regenera ou apaga
      // ocorrencias futuras, e nao faz sentido pagar isso a cada salvamento.
      if (editaLimite && limiteAlvo !== (assinatura.recorreAte ?? null)) {
        await onAlterarLimite(limiteAlvo)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      titulo="Editar assinatura"
      descricao="Mudar o valor mensal aplica o novo valor às ocorrências pendentes em faturas abertas; ocorrências fechadas ou pagas permanecem no histórico."
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
      <Field label="Descrição">
        <Input
          type="text"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          maxLength={80}
          autoFocus
        />
      </Field>

      <Field label="Categoria">
        <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Valor mensal (R$)">
        <Input
          type="text"
          inputMode="decimal"
          value={valorReais}
          onChange={(e) => setValorReais(e.target.value)}
        />
      </Field>

      {editaLimite && (
        <>
          <SegmentedControl
            opcoes={DURACOES}
            valor={duracao}
            onChange={setDuracao}
            label="Duração da recorrência"
          />
          {duracao === 'ate' && (
            <Field label="Recorrente até">
              <Input
                type="date"
                value={recorreAte}
                onChange={(e) => setRecorreAte(e.target.value)}
              />
            </Field>
          )}
        </>
      )}

      {erro && <p className={styles.erro}>{erro}</p>}
    </Modal>
  )
}
