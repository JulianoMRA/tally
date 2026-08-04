import { useState } from 'react'
import type { StatusRecebimento } from '@domain/entities/recebimento'
import type { Renda } from '@domain/entities/renda'
import type { CriarRendaAvulsaInput, CriarRendaRecorrenteInput } from '@shared/ipc/renda'
import type { CriarRecebimentoAvulsoInput, RecebimentoComContexto } from '@shared/ipc/recebimento'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Panel,
  RowActions,
  SegmentedControl,
  useToast,
  type OpcaoSegmentada
} from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { useRendas } from './hooks/use-rendas'
import { useRecebimentos } from './hooks/use-recebimentos'
import { RendaForm } from './RendaForm'
import { RendaList } from './RendaList'
import { EditarRendaModal } from './EditarRendaModal'
import { MarcarRecebidoModal } from './MarcarRecebidoModal'
import { NovoAvulsoModal } from './NovoAvulsoModal'
import styles from './rendas.module.css'

type Aba = 'recebimentos' | 'fontes'
type StatusFiltro = 'Todos' | StatusRecebimento

const ABAS: readonly OpcaoSegmentada<Aba>[] = [
  { valor: 'recebimentos', rotulo: 'Recebimentos do mês' },
  { valor: 'fontes', rotulo: 'Fontes de renda' }
]

const FILTROS_STATUS: readonly OpcaoSegmentada<StatusFiltro>[] = [
  { valor: 'Todos', rotulo: 'Todos' },
  { valor: 'Esperado', rotulo: 'Esperado' },
  { valor: 'Recebido', rotulo: 'Recebido' }
]

export default function RendasPage() {
  const [aba, setAba] = useState<Aba>('recebimentos')
  const [novoAvulsoAberto, setNovoAvulsoAberto] = useState(false)

  return (
    <PageContainer>
      <PageHead
        title="Rendas"
        subtitle="Recebimentos do mês e fontes de entrada — recorrentes (bolsa, salário) ou avulsas (freela, presente)."
        actions={
          aba === 'recebimentos' ? (
            <Button variant="primary" size="sm" onClick={() => setNovoAvulsoAberto(true)}>
              + Novo avulso
            </Button>
          ) : undefined
        }
      />

      <div className={styles.tabs}>
        <SegmentedControl
          opcoes={ABAS}
          valor={aba}
          onChange={setAba}
          label="Seção de rendas"
          semantica="abas"
          size="md"
        />
      </div>

      {aba === 'recebimentos' ? (
        <AbaRecebimentos
          novoAvulsoAberto={novoAvulsoAberto}
          onFecharNovoAvulso={() => setNovoAvulsoAberto(false)}
        />
      ) : (
        <AbaFontes />
      )}
    </PageContainer>
  )
}

function AbaRecebimentos({
  novoAvulsoAberto,
  onFecharNovoAvulso
}: {
  novoAvulsoAberto: boolean
  onFecharNovoAvulso: () => void
}) {
  const [mes, setMes] = useState(mesAtualReferencia())
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('Todos')
  const { recebimentos, loading, erro, recarregar } = useRecebimentos({
    mesReferencia: mes,
    status: statusFiltro === 'Todos' ? undefined : statusFiltro
  })
  const [alvoMarcar, setAlvoMarcar] = useState<RecebimentoComContexto | null>(null)
  const [acaoErro, setAcaoErro] = useState<string | null>(null)
  const [alvoExcluir, setAlvoExcluir] = useState<RecebimentoComContexto | null>(null)

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
    onFecharNovoAvulso()
    await recarregar()
  }

  async function confirmarExcluir() {
    if (!alvoExcluir) return
    setAcaoErro(null)
    try {
      await window.api.recebimento.excluir({ recebimentoId: alvoExcluir.id })
      await recarregar()
    } catch (e) {
      setAcaoErro(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setAlvoExcluir(null)
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
    <>
      <div className={styles.toolbar}>
        <Field label="Mês">
          <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </Field>

        <SegmentedControl
          opcoes={FILTROS_STATUS}
          valor={statusFiltro}
          onChange={setStatusFiltro}
          label="Filtrar recebimentos por status"
        />
      </div>

      {erro && <p className={styles.erro}>{erro}</p>}
      {acaoErro && <p className={styles.erro}>{acaoErro}</p>}

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
              <span className={styles.data}>esperada {formatarDataIso(r.dataEsperada)}</span>
              <span className={styles.valor}>{formatBRL(r.valorCentavos)}</span>
              <span className={styles.data}>
                {r.status === 'Recebido' ? (
                  <span className={styles.recebidaInfo}>
                    Recebido {formatarDataIso(r.dataRecebida)}
                  </span>
                ) : (
                  <span>Esperado</span>
                )}
              </span>
              <div className={styles.acoes}>
                {r.status === 'Esperado' && (
                  <Button size="sm" variant="primary" onClick={() => setAlvoMarcar(r)}>
                    Marcar recebido
                  </Button>
                )}
                <RowActions
                  acoes={[
                    {
                      label: 'Excluir',
                      onClick: () => setAlvoExcluir(r),
                      destrutiva: true
                    }
                  ]}
                  visiveis={0}
                  contexto={r.rendaNome ?? 'recebimento avulso'}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {alvoMarcar && (
        <MarcarRecebidoModal
          descricao={alvoMarcar.rendaNome ?? `Recebimento #${alvoMarcar.id}`}
          valorReais={formatBRL(alvoMarcar.valorCentavos)}
          onConfirmar={handleMarcarRecebido}
          onCancelar={() => setAlvoMarcar(null)}
        />
      )}

      {novoAvulsoAberto && (
        <NovoAvulsoModal onConfirmar={handleCriarAvulso} onCancelar={onFecharNovoAvulso} />
      )}

      {alvoExcluir && (
        <ConfirmDialog
          title="Excluir recebimento?"
          body={`${formatBRL(alvoExcluir.valorCentavos)} — ${alvoExcluir.rendaNome ?? 'avulso'}. Esta acao e irreversivel.`}
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={confirmarExcluir}
          onCancel={() => setAlvoExcluir(null)}
        />
      )}
    </>
  )
}

function AbaFontes() {
  const { rendas, loading, error, incluirArquivadas, setIncluirArquivadas, refetch } = useRendas()
  const [rendaEditar, setRendaEditar] = useState<Renda | null>(null)
  const toast = useToast()

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

  async function handleConfirmarEditar(input: {
    nome: string
    valorPadraoCentavos: number
    diaEsperado?: number | null
  }) {
    if (!rendaEditar) return
    try {
      await window.api.renda.update(rendaEditar.id, input)
      toast.show(`"${input.nome}" atualizada.`, 'success')
      setRendaEditar(null)
      await refetch()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao salvar.'), 'error')
      throw e
    }
  }

  return (
    <>
      <div className={styles.fontesToggle}>
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
              onEditar={setRendaEditar}
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

      {rendaEditar && (
        <EditarRendaModal
          renda={rendaEditar}
          onConfirmar={handleConfirmarEditar}
          onCancelar={() => setRendaEditar(null)}
        />
      )}
    </>
  )
}

function FontesAgrupadas({
  rendas,
  onEditar,
  onArquivar,
  onDesarquivar
}: {
  rendas: Renda[]
  onEditar: (renda: Renda) => void
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
        <RendaList
          rendas={recorrentes}
          onEditar={onEditar}
          onArquivar={onArquivar}
          onDesarquivar={onDesarquivar}
        />
      </Panel>

      <Panel
        title="Avulsas"
        meta={`${avulsas.length} ${avulsas.length === 1 ? 'fonte' : 'fontes'}`}
        flush
        className={styles.panel}
      >
        <RendaList
          rendas={avulsas}
          onEditar={onEditar}
          onArquivar={onArquivar}
          onDesarquivar={onDesarquivar}
        />
      </Panel>
    </>
  )
}
