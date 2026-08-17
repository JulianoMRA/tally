import { useEffect, useMemo, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type { Fatura } from '@domain/entities/fatura'
import type { Parcela } from '@domain/entities/parcela'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import { hojeIsoLocal } from '@shared/datas-locais'
import { useCicloFatura } from './hooks/use-faturas'
import { AdiantarParcelasModal } from './AdiantarParcelasModal'
import { dataParcelaExibida } from './data-parcela'
import { EditarDespesaModal } from './EditarDespesaModal'
import {
  Badge,
  Button,
  ConfirmDialog,
  Panel,
  EmptyState,
  Field,
  Input,
  RowActions,
  SortableHeader,
  useToast,
  type AcaoLinha
} from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { rotuloVencida } from './aviso-fechamento'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'

type DialogoConfirma =
  | { tipo: 'fechar' }
  | { tipo: 'reabrir' }
  | { tipo: 'excluir'; despesaId: number }

type SortBy = 'descricao' | 'parcela' | 'data' | 'valor' | 'status'
type SortDir = 'asc' | 'desc'

function compararParcelas(
  a: Parcela,
  b: Parcela,
  by: SortBy,
  despesas: FaturaDetalhada['despesasPorParcela']
): number {
  switch (by) {
    case 'descricao': {
      const da = despesas?.[a.id]?.descricao ?? `#${a.despesaId}`
      const db = despesas?.[b.id]?.descricao ?? `#${b.despesaId}`
      return da.localeCompare(db, 'pt-BR')
    }
    case 'parcela':
      return a.numero - b.numero || (a.total ?? 0) - (b.total ?? 0)
    case 'data':
      return dataParcelaExibida(a, despesas?.[a.id]).localeCompare(
        dataParcelaExibida(b, despesas?.[b.id])
      )
    case 'valor':
      return a.valorCentavos - b.valorCentavos
    case 'status':
      return a.status.localeCompare(b.status)
  }
}

type Props = {
  detalhe: FaturaDetalhada
  cartaoNome: string
  cartaoCor?: string
  onFaturaAtualizada: (fatura: Fatura) => void
  onDetalheAtualizado: (detalhe: FaturaDetalhada) => void
}

export function FaturaDetalhe({
  detalhe,
  cartaoNome,
  cartaoCor,
  onFaturaAtualizada,
  onDetalheAtualizado
}: Props) {
  const { fatura, parcelas, totalCentavos } = detalhe
  const kind = fatura.status.kind
  const avisoVencida = rotuloVencida(fatura, hojeIsoLocal())

  const [modoPagar, setModoPagar] = useState(false)
  const [dataPagamento, setDataPagamento] = useState(hojeIsoLocal)
  const [parcelaAdiantar, setParcelaAdiantar] = useState<Parcela | null>(null)
  const [despesaEditar, setDespesaEditar] = useState<Despesa | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [dialogo, setDialogo] = useState<DialogoConfirma | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('data')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const toast = useToast()

  useEffect(() => {
    window.api.categoria.list({ tipo: 'Despesa' }).then(setCategorias)
  }, [])

  const parcelasOrdenadas = useMemo(() => {
    const copia = [...parcelas]
    copia.sort((a, b) => {
      const c = compararParcelas(a, b, sortBy, detalhe.despesasPorParcela)
      return sortDir === 'asc' ? c : -c
    })
    return copia
  }, [parcelas, sortBy, sortDir, detalhe.despesasPorParcela])

  function handleSort(col: SortBy) {
    if (col === sortBy) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  // Editar é a primária; Adiantar só existe em parcelada pendente de fatura
  // Aberta, e Excluir remove a despesa inteira — por isso vai no menu, marcada
  // como destrutiva, em vez de repetir um botão solto em cada linha.
  function acoesDaParcela(p: Parcela): AcaoLinha[] {
    const despesa = detalhe.despesasPorParcela?.[p.id]
    const acoes: AcaoLinha[] = []

    if (p.status === 'Pendente' && despesa) {
      acoes.push({
        label: 'Editar',
        onClick: () => setDespesaEditar(despesa),
        disabled: despesa.tipo === 'Assinatura',
        title:
          despesa.tipo === 'Assinatura' ? 'Assinaturas se editam na tela Saídas' : 'Editar despesa'
      })
    }

    if (kind === 'Aberta' && p.status === 'Pendente' && despesa?.tipo === 'Parcelada') {
      acoes.push({
        label: 'Adiantar',
        onClick: () => setParcelaAdiantar(p),
        title: 'Adiantar para outra fatura'
      })
    }

    acoes.push({
      label: 'Excluir',
      onClick: () => setDialogo({ tipo: 'excluir', despesaId: p.despesaId }),
      disabled: p.status === 'Paga',
      destrutiva: true,
      title:
        p.status === 'Paga'
          ? 'Não é possível excluir uma despesa com parcela paga'
          : 'Excluir despesa inteira'
    })

    return acoes
  }

  const ciclo = useCicloFatura(onFaturaAtualizada)

  async function recarregarDetalhe() {
    const atualizada = await window.api.fatura.detalharComParcelas(fatura.id)
    if (atualizada) {
      onFaturaAtualizada(atualizada.fatura)
      onDetalheAtualizado(atualizada)
    }
  }

  async function handleAdiantar(despesaId: number, quantidade: number, faturaDestinoId: number) {
    await window.api.despesa.adiantarParcelas({ despesaId, quantidade, faturaDestinoId })
    toast.show(`${quantidade} parcela(s) adiantada(s).`, 'success')
    setParcelaAdiantar(null)
    await recarregarDetalhe()
  }

  async function handleConfirmarEditarDespesa(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
    dataCompra?: string
  }) {
    if (!despesaEditar) return
    try {
      await window.api.despesa.atualizar({
        despesaId: despesaEditar.id,
        ...input
      })
      toast.show('Despesa atualizada.', 'success')
      setDespesaEditar(null)
      await recarregarDetalhe()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao atualizar despesa.'), 'error')
      throw e
    }
  }

  async function confirmarExcluirDespesa(despesaId: number) {
    try {
      await window.api.despesa.excluir({ despesaId })
      toast.show('Despesa excluída.', 'success')
      await recarregarDetalhe()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir despesa.'), 'error')
    } finally {
      setDialogo(null)
    }
  }

  function handlePagarConfirmar() {
    ciclo.pagar(fatura.id, dataPagamento).then(() => setModoPagar(false))
  }

  return (
    <div className={styles.detalhe}>
      <div className={`${styles.detalheHeader} ${styles.areaHeader}`}>
        <div className={styles.detalheTitle}>
          {cartaoCor && <span className={styles.cardChip} style={{ background: cartaoCor }} />}
          <h2 className={styles.detalheTitleText}>
            {cartaoNome} · {formatarMesReferencia(fatura.mesReferencia, { capitalizar: true })}
          </h2>
        </div>
      </div>

      <aside className={styles.areaAside}>
        <div className={styles.resumoCard}>
          <div className={styles.resumoLinha}>
            <span className={styles.resumoLabel}>Mês</span>
            <span className={styles.resumoValor}>
              {formatarMesReferencia(fatura.mesReferencia, { capitalizar: true })}
            </span>
          </div>
          <div className={styles.resumoLinha}>
            <span className={styles.resumoLabel}>Fechamento</span>
            <span className={styles.resumoValor}>{formatarDataIso(fatura.dataFechamento)}</span>
          </div>
          <div className={styles.resumoLinha}>
            <span className={styles.resumoLabel}>Vencimento</span>
            <span className={styles.resumoValor}>{formatarDataIso(fatura.dataVencimento)}</span>
          </div>
          <div className={styles.resumoLinha}>
            <span className={styles.resumoLabel}>Status</span>
            <span className={styles.statusValor}>
              <Badge variant={statusVariant(kind)} />
              {avisoVencida && <span className={styles.avisoVencida}>{avisoVencida}</span>}
            </span>
          </div>
          <div className={`${styles.resumoLinha} ${styles.resumoTotalLinha}`}>
            <span className={styles.resumoLabel}>Total da fatura</span>
            <span className={styles.resumoTotalValor}>{formatBRL(totalCentavos)}</span>
          </div>

          <div className={styles.cicloActions}>
            {kind === 'Aberta' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDialogo({ tipo: 'fechar' })}
                disabled={ciclo.loading}
              >
                Fechar fatura
              </Button>
            )}
            {kind === 'Fechada' && !modoPagar && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setModoPagar(true)}
                disabled={ciclo.loading}
              >
                Marcar como paga
              </Button>
            )}
            {kind === 'Fechada' && modoPagar && (
              <div className={styles.pagarForm}>
                <Field label="Data de pagamento">
                  <Input
                    type="date"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </Field>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handlePagarConfirmar}
                  disabled={ciclo.loading}
                >
                  Confirmar pagamento
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoPagar(false)}
                  disabled={ciclo.loading}
                >
                  Cancelar
                </Button>
              </div>
            )}
            {kind === 'Paga' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDialogo({ tipo: 'reabrir' })}
                disabled={ciclo.loading}
              >
                Reabrir fatura
              </Button>
            )}
            {ciclo.erro && <p className={styles.erroAcao}>{ciclo.erro}</p>}
          </div>
        </div>
      </aside>

      {despesaEditar && (
        <EditarDespesaModal
          despesa={despesaEditar}
          categorias={categorias}
          onConfirmar={handleConfirmarEditarDespesa}
          onCancelar={() => setDespesaEditar(null)}
        />
      )}

      {parcelaAdiantar && (
        <AdiantarParcelasModal
          despesaId={parcelaAdiantar.despesaId}
          descricao={
            detalhe.despesasPorParcela?.[parcelaAdiantar.id]?.descricao ??
            `#${parcelaAdiantar.despesaId}`
          }
          cartaoId={fatura.cartaoId}
          faturaAtualId={fatura.id}
          onConfirmar={handleAdiantar}
          onCancelar={() => setParcelaAdiantar(null)}
        />
      )}

      <div className={styles.areaMain}>
        <Panel
          title="Parcelas"
          meta={`${parcelas.length} lançamento${parcelas.length !== 1 ? 's' : ''}`}
          flush
        >
          {parcelas.length === 0 ? (
            <EmptyState title="Nenhuma parcela nesta fatura." />
          ) : (
            <>
              <table className={styles.tabela}>
                <thead>
                  <tr>
                    <SortableHeader
                      rotulo="Descrição"
                      ativo={sortBy === 'descricao'}
                      direcao={sortDir}
                      onSort={() => handleSort('descricao')}
                    />
                    <SortableHeader
                      rotulo="Parcela"
                      ativo={sortBy === 'parcela'}
                      direcao={sortDir}
                      onSort={() => handleSort('parcela')}
                    />
                    <SortableHeader
                      rotulo="Data"
                      ativo={sortBy === 'data'}
                      direcao={sortDir}
                      onSort={() => handleSort('data')}
                    />
                    <SortableHeader
                      rotulo="Valor"
                      ativo={sortBy === 'valor'}
                      direcao={sortDir}
                      onSort={() => handleSort('valor')}
                      className={styles.colValor}
                    />
                    <SortableHeader
                      rotulo="Status"
                      ativo={sortBy === 'status'}
                      direcao={sortDir}
                      onSort={() => handleSort('status')}
                    />
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {parcelasOrdenadas.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {detalhe.despesasPorParcela?.[p.id]?.descricao ?? `#${p.despesaId}`}
                        {detalhe.despesasPorParcela?.[p.id]?.tipo === 'Assinatura' && (
                          <span className={styles.tagAssinatura}>Assinatura</span>
                        )}
                      </td>
                      <td className="mono">
                        {p.total === null ? 'Mensal' : `${p.numero}/${p.total}`}
                      </td>
                      <td>
                        {formatarDataIso(dataParcelaExibida(p, detalhe.despesasPorParcela?.[p.id]))}
                      </td>
                      <td className={`${styles.colValor} tnum`}>{formatBRL(p.valorCentavos)}</td>
                      <td>
                        <Badge variant={p.status === 'Paga' ? 'paid' : 'pending'} />
                      </td>
                      <td>
                        <RowActions
                          acoes={acoesDaParcela(p)}
                          contexto={detalhe.despesasPorParcela?.[p.id]?.descricao}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.totaisFooter}>
                <div className={`${styles.totalLinha} ${styles.totalLiquidoLinha}`}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={`${styles.totalLiquidoValor} tnum`}>
                    {formatBRL(totalCentavos)}
                  </span>
                </div>
              </div>
            </>
          )}
        </Panel>
      </div>

      {dialogo?.tipo === 'fechar' && (
        <ConfirmDialog
          title="Fechar fatura?"
          body="Após fechada, novas parcelas só entram via adiantamento explícito."
          confirmText="Fechar"
          onConfirm={() => {
            ciclo.fechar(fatura.id)
            setDialogo(null)
          }}
          onCancel={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'reabrir' && (
        <ConfirmDialog
          title="Reabrir fatura?"
          body="A data de pagamento será apagada. A fatura volta a Aberta — ou a Fechada, se a data de fechamento já tiver passado."
          confirmText="Reabrir"
          onConfirm={() => {
            ciclo.reabrir(fatura.id)
            setDialogo(null)
          }}
          onCancel={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'excluir' && (
        <ConfirmDialog
          title="Excluir despesa?"
          body="A despesa e TODAS as suas parcelas pendentes serão removidas. Esta ação é irreversível."
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={() => confirmarExcluirDespesa(dialogo.despesaId)}
          onCancel={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
