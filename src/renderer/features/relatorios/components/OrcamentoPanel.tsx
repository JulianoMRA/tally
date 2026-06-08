import { useMemo, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { StatusOrcamento } from '@domain/services/calcular-orcamento'
import { Button, EmptyState, Field, Input, Select } from '../../../components/ui'
import { formatBRL } from '../../../lib/format-brl'
import { useOrcamento } from '../hooks/use-orcamento'
import styles from '../relatorios.module.css'

type Props = { mes: string; categorias: Categoria[] }

const VALOR_REGEX = /^\d+([.,]\d{1,2})?$/

function parseCentavos(reais: string): number {
  return Math.round(parseFloat(reais.replace(',', '.')) * 100)
}

const FILL_CLASS: Record<StatusOrcamento, string> = {
  ok: styles.fillOk,
  alerta: styles.fillAlerta,
  estourado: styles.fillEstourado
}

const TEXT_CLASS: Record<StatusOrcamento, string> = {
  ok: styles.textOk,
  alerta: styles.textAlerta,
  estourado: styles.textEstourado
}

const STATUS_LABEL: Record<StatusOrcamento, string> = {
  ok: 'No limite',
  alerta: 'Atenção',
  estourado: 'Estourado'
}

export function OrcamentoPanel({ mes, categorias }: Props) {
  const { progresso, loading, erro, definirLimite, removerLimite } = useOrcamento(mes)
  const [categoriaId, setCategoriaId] = useState('')
  const [limiteReais, setLimiteReais] = useState('')

  const categoriasSemLimite = useMemo(() => {
    const comLimite = new Set(progresso.map((p) => p.categoriaId))
    return categorias.filter((c) => !comLimite.has(c.id))
  }, [categorias, progresso])

  const podeDefinir = categoriaId !== '' && VALOR_REGEX.test(limiteReais)

  async function handleDefinir() {
    if (!podeDefinir) return
    await definirLimite({
      categoriaId: Number(categoriaId),
      valorLimiteCentavos: parseCentavos(limiteReais)
    })
    setCategoriaId('')
    setLimiteReais('')
  }

  return (
    <>
      <div className={styles.orcForm}>
        <Field label="Categoria">
          <Select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">— selecione —</option>
            {categoriasSemLimite.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Limite (R$)">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={limiteReais}
            onChange={(e) => setLimiteReais(e.target.value)}
          />
        </Field>
        <Button variant="primary" onClick={handleDefinir} disabled={!podeDefinir}>
          Definir limite
        </Button>
      </div>

      {erro ? <p className={styles.erro}>{erro}</p> : null}

      {loading ? (
        <EmptyState title="Carregando…" />
      ) : progresso.length === 0 ? (
        <EmptyState title="Nenhum limite definido. Defina um limite por categoria acima." />
      ) : (
        <ul className={styles.orcList}>
          {progresso.map((p) => (
            <li key={p.categoriaId} className={styles.orcItem}>
              <span className={styles.rankChip} style={{ background: p.cor }} />
              <div className={styles.orcInfo}>
                <span className={styles.rankNome}>{p.categoriaNome}</span>
                <span className={styles.orcValores}>
                  {formatBRL(p.realizadoCentavos)} de {formatBRL(p.limiteCentavos)}
                </span>
              </div>
              <div className={styles.orcBarTrack}>
                <div
                  className={`${styles.orcBarFill} ${FILL_CLASS[p.status]}`}
                  style={{ width: `${Math.min(p.percentual, 100)}%` }}
                />
              </div>
              <span className={`${styles.orcPct} ${TEXT_CLASS[p.status]}`}>
                {p.percentual}% · {STATUS_LABEL[p.status]}
              </span>
              <Button variant="ghost" size="sm" onClick={() => removerLimite(p.categoriaId)}>
                Remover
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
