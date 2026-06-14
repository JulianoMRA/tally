import { useEffect, useMemo, useState } from 'react'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type {
  DespesaUnicaCreditoInput,
  DespesaParceladaCreditoInput,
  DespesaEmAndamentoInput,
  DespesaAssinaturaCreditoInput,
  DespesaUnicaForaCartaoInput
} from '@shared/ipc/despesa'
import { PageHead } from '../../components/layout/PageHead'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Panel,
  useToast
} from '../../components/ui'
import { alfabetico, porData, porNumero, type Comparador } from '../../lib/comparadores'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { DespesaForm } from '../despesas/DespesaForm'
import { EditarDespesaModal } from '../faturas/EditarDespesaModal'
import { EditarAssinaturaModal } from '../assinaturas/EditarAssinaturaModal'
import { useSaidas } from './hooks/use-saidas'
import styles from './saidas.module.css'

type Filtro = 'todas' | 'foraCartao' | 'parcelada' | 'assinatura'

type UltimaRegistrada = {
  descricao: string
  mesReferencia: string
  cartaoNome: string
  parcelas?: number
  formaForaCartao?: 'Pix' | 'Debito' | 'Dinheiro'
}

type Confirmacao = { tipo: 'cancelar'; despesa: Despesa } | { tipo: 'excluir'; despesa: Despesa }

const COMPARADORES: Record<string, Comparador<Despesa>> = {
  descricao: alfabetico((d) => d.descricao),
  data: porData((d) => d.dataCompra),
  valor: porNumero((d) => d.valorCentavos)
}

function rotuloTipo(d: Despesa): string {
  if (d.tipo === 'Assinatura') return 'Assinatura'
  if (d.tipo === 'Parcelada') return 'Parcelada'
  if (d.formaPagamento === 'Credito') return 'Única'
  return 'Fora do cartão'
}

function pertenceAoFiltro(d: Despesa, filtro: Filtro): boolean {
  switch (filtro) {
    case 'todas':
      return true
    case 'foraCartao':
      return d.tipo === 'Unica' && d.formaPagamento !== 'Credito'
    case 'parcelada':
      return d.tipo === 'Parcelada'
    case 'assinatura':
      return d.tipo === 'Assinatura'
  }
}

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: 'todas', rotulo: 'Todas' },
  { chave: 'foraCartao', rotulo: 'Fora do cartão' },
  { chave: 'parcelada', rotulo: 'Parceladas' },
  { chave: 'assinatura', rotulo: 'Assinaturas' }
]

export default function SaidasPage() {
  const { despesas, loading, erro, recarregar } = useSaidas()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [ultimaRegistrada, setUltimaRegistrada] = useState<UltimaRegistrada | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [mes, setMes] = useState('')
  const [editandoDespesa, setEditandoDespesa] = useState<Despesa | null>(null)
  const [editandoAssinatura, setEditandoAssinatura] = useState<Despesa | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const toast = useToast()

  useEffect(() => {
    window.api.cartao.list({ incluirArquivados: true }).then(setCartoes)
    window.api.categoria.list({ tipo: 'Despesa' }).then(setCategorias)
  }, [])

  const cartoesAtivos = useMemo(() => cartoes.filter((c) => c.ativo), [cartoes])

  function nomeCartao(id: number | null): string {
    if (id === null) return '—'
    return cartoes.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  function corCartao(id: number | null): string | undefined {
    if (id === null) return 'var(--ink-3)'
    return cartoes.find((c) => c.id === id)?.cor ?? 'var(--ink-3)'
  }

  function nomeCategoria(id: number): string {
    return categorias.find((c) => c.id === id)?.nome ?? `#${id}`
  }

  const filtradas = useMemo(() => {
    return despesas.filter((d) => {
      if (!pertenceAoFiltro(d, filtro)) return false
      if (filtro === 'foraCartao' && mes && d.dataCompra.slice(0, 7) !== mes) return false
      return true
    })
  }, [despesas, filtro, mes])

  const { itensOrdenados, handleSort, sortIndicator } = useOrdenacao(
    filtradas,
    COMPARADORES,
    'data',
    'desc'
  )

  async function registrar<T>(
    acao: () => Promise<T>,
    montarBanner: (resultado: T) => UltimaRegistrada,
    erroMsg: string
  ) {
    try {
      const resultado = await acao()
      setUltimaRegistrada(montarBanner(resultado))
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, erroMsg), 'error')
    }
  }

  async function handleSalvarUnica(input: DespesaUnicaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarUnicaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.fatura.mesReferencia,
        cartaoNome: nomeCartao(input.cartaoId)
      }),
      'Erro ao registrar despesa.'
    )
  }

  async function handleSalvarParcelada(input: DespesaParceladaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarParceladaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa parcelada.'
    )
  }

  async function handleSalvarEmAndamento(input: DespesaEmAndamentoInput) {
    await registrar(
      () => window.api.despesa.criarParceladaEmAndamento(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar despesa em andamento.'
    )
  }

  async function handleSalvarUnicaForaCartao(input: DespesaUnicaForaCartaoInput) {
    await registrar(
      () => window.api.despesa.criarUnicaForaCartao(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcela.dataReferencia,
        cartaoNome: '—',
        formaForaCartao: input.formaPagamento
      }),
      'Erro ao registrar gasto fora de cartão.'
    )
  }

  async function handleSalvarAssinatura(input: DespesaAssinaturaCreditoInput) {
    await registrar(
      () => window.api.despesa.criarAssinaturaCredito(input),
      (r) => ({
        descricao: r.despesa.descricao,
        mesReferencia: r.parcelas[0]?.dataReferencia ?? '—',
        cartaoNome: nomeCartao(input.cartaoId),
        parcelas: r.parcelas.length
      }),
      'Erro ao registrar assinatura.'
    )
  }

  async function handleEditarDespesaConfirmar(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
    dataCompra?: string
  }) {
    if (!editandoDespesa) return
    try {
      await window.api.despesa.atualizar({ despesaId: editandoDespesa.id, ...input })
      toast.show('Despesa atualizada.', 'success')
      setEditandoDespesa(null)
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao atualizar despesa.'), 'error')
      throw e
    }
  }

  async function handleEditarAssinaturaConfirmar(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) {
    if (!editandoAssinatura) return
    await window.api.despesa.atualizar({ despesaId: editandoAssinatura.id, ...input })
    toast.show('Assinatura atualizada.', 'success')
    setEditandoAssinatura(null)
    await recarregar()
  }

  async function confirmarCancelar(despesa: Despesa) {
    try {
      await window.api.despesa.cancelarAssinatura({ despesaId: despesa.id })
      toast.show(`"${despesa.descricao}" cancelada.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao cancelar assinatura.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  async function confirmarExcluir(despesa: Despesa) {
    try {
      await window.api.despesa.excluir({ despesaId: despesa.id })
      toast.show(`"${despesa.descricao}" excluída.`, 'success')
      await recarregar()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir despesa.'), 'error')
    } finally {
      setConfirmacao(null)
    }
  }

  return (
    <div>
      <PageHead
        title="Saídas"
        subtitle="Cadastre e gerencie despesas, gastos e assinaturas em um só lugar."
      />

      <div className={styles.body}>
        <div className={styles.layout}>
          <div className={styles.colCadastro}>
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
                    <strong>{formatarMesReferencia(ultimaRegistrada.mesReferencia)}</strong> ·
                    cartão <strong>{ultimaRegistrada.cartaoNome}</strong>.
                  </>
                )}
              </div>
            )}

            <DespesaForm
              cartoes={cartoesAtivos}
              categorias={categorias}
              onSalvarUnica={handleSalvarUnica}
              onSalvarUnicaForaCartao={handleSalvarUnicaForaCartao}
              onSalvarParcelada={handleSalvarParcelada}
              onSalvarEmAndamento={handleSalvarEmAndamento}
              onSalvarAssinatura={handleSalvarAssinatura}
            />
          </div>

          <div className={styles.colLista}>
            <div className={styles.toolbar}>
              {FILTROS.map((f) => (
                <Button
                  key={f.chave}
                  variant={filtro === f.chave ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFiltro(f.chave)}
                >
                  {f.rotulo}
                </Button>
              ))}
              {filtro === 'foraCartao' && (
                <Field label="Mês">
                  <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
                </Field>
              )}
            </div>

            {erro && <p className={styles.erro}>{erro}</p>}

            <Panel title="Lançamentos" meta={`${itensOrdenados.length}`} flush>
              {loading ? (
                <EmptyState title="Carregando…" />
              ) : itensOrdenados.length === 0 ? (
                <EmptyState title="Nenhuma saída para este filtro." />
              ) : (
                <table className={styles.tabela}>
                  <thead>
                    <tr>
                      <th className={styles.thSortavel} onClick={() => handleSort('descricao')}>
                        Descrição{sortIndicator('descricao')}
                      </th>
                      <th>Tipo</th>
                      <th>Categoria</th>
                      <th className={styles.thSortavel} onClick={() => handleSort('data')}>
                        Data{sortIndicator('data')}
                      </th>
                      <th
                        className={`${styles.colValor} ${styles.thSortavel}`}
                        onClick={() => handleSort('valor')}
                      >
                        Valor{sortIndicator('valor')}
                      </th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {itensOrdenados.map((d) => {
                      const ehAssinatura = d.tipo === 'Assinatura'
                      return (
                        <tr key={d.id} className={!d.ativa ? styles.itemCancelada : undefined}>
                          <td>
                            <div className={styles.descricaoCell}>
                              <span
                                className={styles.chip}
                                style={{ background: corCartao(d.cartaoId) }}
                              />
                              <span>{d.descricao}</span>
                              {!d.ativa && <Badge variant="archived" label="Cancelada" />}
                            </div>
                          </td>
                          <td>
                            <span className={styles.tagTipo}>{rotuloTipo(d)}</span>
                          </td>
                          <td>{nomeCategoria(d.categoriaId)}</td>
                          <td className="mono">{formatarDataIso(d.dataCompra)}</td>
                          <td className={`${styles.colValor} tnum`}>
                            {formatBRL(d.valorCentavos)}
                            {ehAssinatura ? '/mês' : ''}
                          </td>
                          <td>
                            <div className={styles.rowActions}>
                              {ehAssinatura && d.ativa && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditandoAssinatura(d)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setConfirmacao({ tipo: 'cancelar', despesa: d })}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              )}
                              {!ehAssinatura && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditandoDespesa(d)}
                                >
                                  Editar
                                </Button>
                              )}
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setConfirmacao({ tipo: 'excluir', despesa: d })}
                              >
                                Excluir
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {editandoDespesa && (
        <EditarDespesaModal
          despesa={editandoDespesa}
          categorias={categorias}
          onConfirmar={handleEditarDespesaConfirmar}
          onCancelar={() => setEditandoDespesa(null)}
        />
      )}

      {editandoAssinatura && (
        <EditarAssinaturaModal
          assinatura={editandoAssinatura}
          categorias={categorias}
          onConfirmar={handleEditarAssinaturaConfirmar}
          onCancelar={() => setEditandoAssinatura(null)}
        />
      )}

      {confirmacao?.tipo === 'cancelar' && (
        <ConfirmDialog
          title={`Cancelar "${confirmacao.despesa.descricao}"?`}
          body="As ocorrências em faturas abertas serão removidas. Ocorrências em faturas já fechadas ou pagas permanecem no histórico."
          confirmText="Cancelar assinatura"
          confirmVariant="danger"
          onConfirm={() => confirmarCancelar(confirmacao.despesa)}
          onCancel={() => setConfirmacao(null)}
        />
      )}
      {confirmacao?.tipo === 'excluir' && (
        <ConfirmDialog
          title={`Excluir "${confirmacao.despesa.descricao}"?`}
          body="A despesa e TODAS as parcelas pendentes serão removidas. Esta ação é irreversível e bloqueia se houver parcela já paga."
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={() => confirmarExcluir(confirmacao.despesa)}
          onCancel={() => setConfirmacao(null)}
        />
      )}
    </div>
  )
}
