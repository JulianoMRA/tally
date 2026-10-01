import { useMemo, useState } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type { Fatura } from '@domain/entities/fatura'
import type { Parcela } from '@domain/entities/parcela'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import type { MotivoBloqueioExclusao } from '@domain/services/regras-despesa'
import { hojeIsoLocal } from '@shared/datas-locais'
import { useCicloFatura } from './hooks/use-faturas'
import { AdiantarParcelasModal } from './AdiantarParcelasModal'
import { avisoDoAdiantamento } from './aviso-adiantamento'
import { dataParcelaExibida } from './data-parcela'
import { EditarDespesaModal } from './EditarDespesaModal'
import { PagarFaturaModal } from './PagarFaturaModal'
import {
  Badge,
  BolinhaDeCor,
  BotaoSeta,
  Button,
  ConfirmDialog,
  EmptyState,
  Panel,
  RowActions,
  SortableHeader,
  Table,
  useToast,
  type AcaoLinha
} from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarMesReferencia } from '../../lib/formatar-data'
import { mensagemErro } from '../../lib/mensagem-erro'
import { pluralizar } from '../../lib/pluralizar'
import { avisoDePrazo } from './aviso-fechamento'
import { statusVariant } from './status-variant'
import styles from './faturas.module.css'
import { useCargaAuxiliar } from '../../hooks/use-carga-auxiliar'

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

/**
 * Por que Excluir está desabilitado nesta linha, ou null quando não está
 * (RF-DES-09). O bloqueio vem do main, que olha todas as parcelas da despesa;
 * antes a tela só conferia a parcela da linha e oferecia Excluir onde ele
 * sempre falharia, depois do diálogo "irreversível".
 */
function motivoDoBloqueio(p: Parcela, bloqueio: MotivoBloqueioExclusao | undefined): string | null {
  if (p.status === 'Paga' || bloqueio === 'has-parcela-paga') {
    return 'Não dá para excluir: a despesa tem parcela paga.'
  }
  if (bloqueio === 'has-parcela-em-fatura-fechada') {
    return 'Não dá para excluir: a despesa tem parcela em fatura fechada ou paga.'
  }
  return null
}

/** A fatura vizinha para onde uma seta do título leva (RF-FAT-06). */
export type Vizinha = { mesReferencia: string; abrir: () => void }

type Props = {
  detalhe: FaturaDetalhada
  cartaoNome: string
  cartaoCor?: string
  /** Sem vizinha, a seta fica desabilitada. */
  anterior?: Vizinha
  proxima?: Vizinha
  onFaturaAtualizada: (fatura: Fatura) => void
  onDetalheAtualizado: (detalhe: FaturaDetalhada) => void
}

export function FaturaDetalhe({
  detalhe,
  cartaoNome,
  cartaoCor,
  anterior,
  proxima,
  onFaturaAtualizada,
  onDetalheAtualizado
}: Props) {
  const { fatura, parcelas, totalCentavos } = detalhe
  const kind = fatura.status.kind
  const aviso = avisoDePrazo(fatura, hojeIsoLocal())

  const [pagando, setPagando] = useState(false)
  const [parcelaAdiantar, setParcelaAdiantar] = useState<Parcela | null>(null)
  const [despesaEditar, setDespesaEditar] = useState<Despesa | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [dialogo, setDialogo] = useState<DialogoConfirma | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>('data')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const toast = useToast()

  // Com as arquivadas: o modal de edição precisa da categoria atual mesmo
  // arquivada, e é ele quem decide o que oferecer (RF-CAT-02).
  useCargaAuxiliar(
    () => window.api.categoria.list({ incluirArquivados: true }),
    setCategorias,
    'Erro ao listar categorias.'
  )

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

    const bloqueio = motivoDoBloqueio(p, detalhe.exclusaoBloqueada?.[p.despesaId])
    acoes.push({
      label: 'Excluir',
      onClick: () => setDialogo({ tipo: 'excluir', despesaId: p.despesaId }),
      disabled: bloqueio !== null,
      destrutiva: true,
      title: bloqueio ?? 'Excluir despesa inteira'
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
    // O aviso conta o que o main moveu: ele só move as elegíveis (RN-03), e
    // repetir a quantidade pedida anunciava parcelas que não saíram do lugar.
    const { movidas } = await window.api.despesa.adiantarParcelas({
      despesaId,
      quantidade,
      faturaDestinoId
    })
    const aviso = avisoDoAdiantamento(movidas.length, quantidade)
    toast.show(aviso.texto, aviso.tipo)
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

  // O diálogo só fecha quando pagar deu certo; a falha fica nele.
  async function confirmarPagamento(dataPagamento: string) {
    if (await ciclo.pagar(fatura.id, dataPagamento)) setPagando(false)
  }

  return (
    <div className={styles.detalhe}>
      {/* A navegação mora junto do título que ela muda. Eram setas de texto
          nas pontas da largura inteira ("← agosto de 2026"), acima do título,
          e "← sem anterior" era um botão desabilitado com texto. */}
      <div className={styles.cabecalho}>
        <BotaoSeta
          direcao="anterior"
          rotulo={
            anterior
              ? `Fatura anterior: ${formatarMesReferencia(anterior.mesReferencia)}`
              : 'Sem fatura anterior'
          }
          onClick={anterior?.abrir}
          disabled={!anterior}
        />
        <BolinhaDeCor cor={cartaoCor} />
        <h2 className={styles.detalheTitleText}>
          {cartaoNome} · {formatarMesReferencia(fatura.mesReferencia, { capitalizar: true })}
        </h2>
        <BotaoSeta
          direcao="proxima"
          rotulo={
            proxima
              ? `Próxima fatura: ${formatarMesReferencia(proxima.mesReferencia)}`
              : 'Sem próxima fatura'
          }
          onClick={proxima?.abrir}
          disabled={!proxima}
        />
      </div>

      {/* Faixa de resumo acima das parcelas (RF-FAT-03/06). Era um card
          lateral a partir de 1360px e, na janela padrão (1266px), um card
          empilhado DEPOIS da tabela: o total e "Marcar como paga" ficavam
          abaixo de todas as parcelas. Numa linha só, ela cabe acima delas sem
          empurrá-las para baixo da dobra. Sai a linha "Mês", que o título já
          diz, e o total deixa a meta do painel, onde se repetia. */}
      <section className={styles.faixa} aria-label="Resumo da fatura">
        <div className={styles.faixaStatus}>
          <Badge variant={statusVariant(kind)} />
          {/* Paga diz quando foi paga; as outras dizem o aviso de prazo, no
              tom do trilho. */}
          {fatura.status.kind === 'Paga' ? (
            <span className={styles.avisoPrazo}>
              Paga em {formatarDataIso(fatura.status.pagaEm)}
            </span>
          ) : (
            aviso && (
              <span className={styles.avisoPrazo} data-tom={aviso.tom}>
                {aviso.texto}
              </span>
            )
          )}
        </div>

        <dl className={styles.faixaDatas}>
          <div className={styles.faixaData}>
            <dt className={styles.faixaRotulo}>Fechamento</dt>
            <dd className={styles.faixaValor}>{formatarDataIso(fatura.dataFechamento)}</dd>
          </div>
          <div className={styles.faixaData}>
            <dt className={styles.faixaRotulo}>Vencimento</dt>
            <dd className={styles.faixaValor}>{formatarDataIso(fatura.dataVencimento)}</dd>
          </div>
        </dl>

        <div className={styles.faixaFim}>
          <div className={styles.faixaTotal}>
            <span className={styles.faixaRotulo}>Total da fatura</span>
            <span className={`${styles.faixaTotalValor} tnum`}>{formatBRL(totalCentavos)}</span>
          </div>
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
          {kind === 'Fechada' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setPagando(true)}
              disabled={ciclo.loading}
            >
              Marcar como paga
            </Button>
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
        </div>

        {ciclo.erro && !pagando && <p className={styles.erroAcao}>{ciclo.erro}</p>}
      </section>

      <Panel
        title="Parcelas"
        meta={`${parcelas.length} ${pluralizar('lançamento', parcelas.length)}`}
        flush
      >
        {parcelas.length === 0 ? (
          <EmptyState title="Nenhuma parcela nesta fatura." />
        ) : (
          <>
            <Table>
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
                    alinhamento="direita"
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
            </Table>
          </>
        )}
      </Panel>

      {despesaEditar && (
        <EditarDespesaModal
          despesa={despesaEditar}
          categorias={categorias}
          travaValorEData={
            despesaEditar.tipo === 'Unica' && kind !== 'Aberta'
              ? 'A fatura desta compra está fechada: valor e data não mudam mais.'
              : undefined
          }
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

      {pagando && (
        <PagarFaturaModal
          cartaoNome={cartaoNome}
          mesReferencia={fatura.mesReferencia}
          totalCentavos={totalCentavos}
          loading={ciclo.loading}
          erro={ciclo.erro}
          onConfirmar={confirmarPagamento}
          onCancelar={() => setPagando(false)}
        />
      )}
      {dialogo?.tipo === 'fechar' && (
        <ConfirmDialog
          title="Fechar fatura?"
          body="Depois de fechada, a fatura não recebe mais adiantamentos, o valor das parcelas dela fica travado e as despesas dela não podem mais ser excluídas."
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
