import { useState } from 'react'
import type { StatusRecebimento } from '@domain/entities/recebimento'
import type { CriarRendaAvulsaInput, CriarRendaRecorrenteInput } from '@shared/ipc/renda'
import type { CriarRecebimentoAvulsoInput, RecebimentoComContexto } from '@shared/ipc/recebimento'
import { PageHead } from '../../components/layout/PageHead'
import { Button, EmptyState, Field, Input, Panel } from '../../components/ui'
import { useRendas } from './hooks/use-rendas'
import { useRecebimentos } from './hooks/use-recebimentos'
import { RendaForm } from './RendaForm'
import { RendaList } from './RendaList'
import { MarcarRecebidoModal } from './MarcarRecebidoModal'
import { NovoAvulsoModal } from './NovoAvulsoModal'
import styles from './rendas.module.css'

type Aba = 'recebimentos' | 'fontes'
type StatusFiltro = 'Todos' | StatusRecebimento

function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAtual(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}

export default function RendasPage() {
  const [aba, setAba] = useState<Aba>('recebimentos')

  return (
    <div>
      <PageHead
        title="Rendas"
        subtitle="Recebimentos do mês e fontes de entrada — recorrentes (bolsa, salário) ou avulsas (freela, presente)."
      />

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${aba === 'recebimentos' ? styles.tabBtnActive : ''}`}
          onClick={() => setAba('recebimentos')}
        >
          Recebimentos do mês
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${aba === 'fontes' ? styles.tabBtnActive : ''}`}
          onClick={() => setAba('fontes')}
        >
          Fontes de renda
        </button>
      </div>

      {aba === 'recebimentos' ? <AbaRecebimentos /> : <AbaFontes />}
    </div>
  )
}

function AbaRecebimentos() {
  const [mes, setMes] = useState(mesAtual())
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('Todos')
  const { recebimentos, loading, erro, recarregar } = useRecebimentos({
    mesReferencia: mes,
    status: statusFiltro === 'Todos' ? undefined : statusFiltro
  })
  const [alvoMarcar, setAlvoMarcar] = useState<RecebimentoComContexto | null>(null)
  const [novoAvulso, setNovoAvulso] = useState(false)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)

  async function handleMarcarRecebido(dataRecebida: string) {
    if (!alvoMarcar) return
    await window.api.recebimento.marcarRecebido({
      recebimentoId: alvoMarcar.id,
      dataRecebida
    })
    setAlvoMarcar(null)
    await recarregar()
  }

  async function handleCriarAvulso(input: CriarRecebimentoAvulsoInput) {
    await window.api.recebimento.criarAvulso(input)
    setNovoAvulso(false)
    await recarregar()
  }

  async function handleExcluir(rec: RecebimentoComContexto) {
    const ok = window.confirm(
      `Excluir recebimento de ${formatBRL(rec.valorCentavos)} (${rec.rendaNome ?? 'avulso'})?`
    )
    if (!ok) return
    setAcaoErro(null)
    try {
      await window.api.recebimento.excluir({ recebimentoId: rec.id })
      await recarregar()
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : 'Erro ao excluir.')
    }
  }

  const totalEsperado = recebimentos
    .filter((r) => r.status === 'Esperado')
    .reduce((s, r) => s + r.valorCentavos, 0)
  const totalRecebido = recebimentos
    .filter((r) => r.status === 'Recebido')
    .reduce((s, r) => s + r.valorCentavos, 0)
  const total = totalEsperado + totalRecebido

  return (
    <div className={styles.body}>
      <div className={styles.toolbar}>
        <Field label="Mês">
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </Field>

        <div className={styles.statusGroup}>
          {(['Todos', 'Esperado', 'Recebido'] as StatusFiltro[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`${styles.statusBtn} ${statusFiltro === s ? styles.statusBtnActive : ''}`}
              onClick={() => setStatusFiltro(s)}
            >
              {s}
            </button>
          ))}
        </div>

        <div className={styles.actionsRight}>
          <Button variant="primary" size="sm" onClick={() => setNovoAvulso(true)}>
            + Novo avulso
          </Button>
        </div>
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}
      {acaoErro && <p className={styles.erro}>{acaoErro}</p>}

      {loading ? (
        <EmptyState title="Carregando…" />
      ) : recebimentos.length === 0 ? (
        <EmptyState title="Nenhum recebimento neste filtro." />
      ) : (
        <ul className={styles.lista}>
          {recebimentos.map((r) => (
            <li key={r.id} className={styles.item}>
              <div className={styles.info}>
                <span className={styles.nome}>{r.rendaNome ?? '—'}</span>
                <span className={styles.meta}>
                  {r.rendaId === null ? 'sem fonte' : 'fonte cadastrada'}
                </span>
              </div>
              <span className={styles.data}>esperada {r.dataEsperada}</span>
              <span className={styles.valor}>{formatBRL(r.valorCentavos)}</span>
              <span className={styles.data}>
                {r.status === 'Recebido' ? (
                  <span className={styles.recebidaInfo}>Recebido {r.dataRecebida}</span>
                ) : (
                  <span>Pendente</span>
                )}
              </span>
              <div className={styles.acoes}>
                {r.status === 'Esperado' && (
                  <Button size="sm" variant="primary" onClick={() => setAlvoMarcar(r)}>
                    Marcar recebido
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleExcluir(r)}>
                  Excluir
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {recebimentos.length > 0 && (
        <div className={styles.totaisRow}>
          <div className={styles.totalCard}>
            <div className={styles.totalLabel}>Esperado</div>
            <div className={styles.totalValor}>{formatBRL(totalEsperado)}</div>
          </div>
          <div className={styles.totalCard}>
            <div className={styles.totalLabel}>Recebido</div>
            <div className={`${styles.totalValor} ${styles.totalValorIncome}`}>
              {formatBRL(totalRecebido)}
            </div>
          </div>
          <div className={styles.totalCard}>
            <div className={styles.totalLabel}>Total do mês</div>
            <div className={styles.totalValor}>{formatBRL(total)}</div>
          </div>
        </div>
      )}

      {alvoMarcar && (
        <MarcarRecebidoModal
          descricao={alvoMarcar.rendaNome ?? `Recebimento #${alvoMarcar.id}`}
          valorReais={formatBRL(alvoMarcar.valorCentavos)}
          onConfirmar={handleMarcarRecebido}
          onCancelar={() => setAlvoMarcar(null)}
        />
      )}

      {novoAvulso && (
        <NovoAvulsoModal onConfirmar={handleCriarAvulso} onCancelar={() => setNovoAvulso(false)} />
      )}
    </div>
  )
}

function AbaFontes() {
  const { rendas, loading, error, incluirArquivadas, setIncluirArquivadas, refetch } = useRendas()

  async function handleSalvarAvulsa(input: CriarRendaAvulsaInput) {
    await window.api.renda.criarAvulsa(input)
    await refetch()
  }

  async function handleSalvarRecorrente(input: CriarRendaRecorrenteInput) {
    await window.api.renda.criarRecorrente(input)
    await refetch()
  }

  async function handleArquivar(id: number) {
    await window.api.renda.arquivar(id)
    await refetch()
  }

  async function handleDesarquivar(id: number) {
    await window.api.renda.desarquivar(id)
    await refetch()
  }

  return (
    <>
      <div style={{ padding: '0 32px 12px' }}>
        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={incluirArquivadas}
            onChange={(e) => setIncluirArquivadas(e.target.checked)}
          />
          Mostrar arquivadas
        </label>
      </div>

      <div className={styles.layout}>
        <section className={styles.listSection}>
          {loading && <p className={styles.empty}>Carregando…</p>}
          {error && <p className={styles.errorMsg}>{error}</p>}
          {!loading && !error && (
            <FontesAgrupadas
              rendas={rendas}
              onArquivar={handleArquivar}
              onDesarquivar={handleDesarquivar}
            />
          )}
        </section>

        <section className={styles.formSection}>
          <RendaForm
            onSalvarAvulsa={handleSalvarAvulsa}
            onSalvarRecorrente={handleSalvarRecorrente}
          />
        </section>
      </div>
    </>
  )
}

function FontesAgrupadas({
  rendas,
  onArquivar,
  onDesarquivar
}: {
  rendas: import('@domain/entities/renda').Renda[]
  onArquivar: (id: number) => void
  onDesarquivar: (id: number) => void
}) {
  const recorrentes = rendas
    .filter((r) => r.tipo === 'Recorrente')
    .sort((a, b) => (a.diaEsperado ?? 0) - (b.diaEsperado ?? 0) || a.nome.localeCompare(b.nome))
  const avulsas = rendas
    .filter((r) => r.tipo === 'Avulsa')
    .sort((a, b) => a.nome.localeCompare(b.nome))

  const totalMensalRecorrentes = recorrentes
    .filter((r) => r.ativa)
    .reduce((s, r) => s + r.valorPadraoCentavos, 0)

  return (
    <>
      <Panel
        title="Recorrentes"
        meta={`${recorrentes.length} ${recorrentes.length === 1 ? 'fonte' : 'fontes'}${recorrentes.length > 0 ? ` · ${formatBRL(totalMensalRecorrentes)}/mês` : ''}`}
        flush
        className={styles.panel}
      >
        <RendaList rendas={recorrentes} onArquivar={onArquivar} onDesarquivar={onDesarquivar} />
      </Panel>

      <Panel
        title="Avulsas"
        meta={`${avulsas.length} ${avulsas.length === 1 ? 'fonte' : 'fontes'}`}
        flush
        className={styles.panel}
      >
        <RendaList rendas={avulsas} onArquivar={onArquivar} onDesarquivar={onDesarquivar} />
      </Panel>
    </>
  )
}
