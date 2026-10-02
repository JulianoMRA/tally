import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Categoria } from '@domain/entities/categoria'
import type { Despesa } from '@domain/entities/despesa'
import type { PagamentoParcial } from '@domain/entities/pagamento-parcial'
import type { Parcela } from '@domain/entities/parcela'
import { quitadaPorParciais } from '@domain/services/pagamento-parcial'
import type { FaturaDetalhada } from '@shared/ipc/fatura'
import type { MotivoBloqueioExclusao } from '@domain/services/regras-despesa'
import { hojeIsoLocal } from '@shared/datas-locais'
import { useCicloFatura } from './hooks/use-faturas'
import { AdiantarParcelasModal } from './AdiantarParcelasModal'
import { avisoDoAdiantamento } from './aviso-adiantamento'
import { EditarDespesaModal } from './EditarDespesaModal'
import { PagarFaturaModal } from './PagarFaturaModal'
import { RegistrarPagamentoParcialModal } from './RegistrarPagamentoParcialModal'
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
import { alfabetico, porData, porNumero, type Comparador } from '../../lib/comparadores'
import { useOrdenacao } from '../../lib/use-ordenacao'
import { EditarAssinaturaModal } from '../assinaturas/EditarAssinaturaModal'
import { RotuloCategoria } from '../categorias/RotuloCategoria'
import { descreverDataDaOcorrencia } from '../saidas/descrever-data-da-ocorrencia'

type DialogoConfirma =
  | { tipo: 'fechar' }
  | { tipo: 'reabrir' }
  | { tipo: 'excluir'; despesaId: number }
  | { tipo: 'excluir-pagamento'; pagamento: PagamentoParcial }

/** A parcela com a despesa dela: é o que cada linha da tabela mostra. */
type Linha = { parcela: Parcela; despesa: Despesa | undefined }

/**
 * Mesmos comparadores e mesmo `useOrdenacao` de Saídas e da Busca: duas
 * implementações fariam o mesmo clique se comportar diferente em duas telas.
 * Parcela não entra — "à vista", "mensal" e "1/6" não têm ordem natural.
 */
const COMPARADORES: Record<string, Comparador<Linha>> = {
  descricao: alfabetico((l) => l.despesa?.descricao ?? `#${l.parcela.despesaId}`),
  compra: porData((l) => l.despesa?.dataCompra ?? l.parcela.dataReferencia),
  valor: porNumero((l) => l.parcela.valorCentavos)
}

/**
 * Célula da coluna Compra, como em Saídas: a data da compra, ou "desde
 * MM/AAAA" em tom de apoio para assinatura. A fatura mostrava a data de
 * referência da assinatura, que é sempre dia 01 — um dia que ninguém foi
 * cobrado.
 */
function CelulaDeCompra({ linha }: { linha: Linha }) {
  if (!linha.despesa)
    return <span className="tnum">{formatarDataIso(linha.parcela.dataReferencia)}</span>
  const { texto, apoio } = descreverDataDaOcorrencia(linha.despesa)
  return <span className={apoio ? styles.compraApoio : 'tnum'}>{texto}</span>
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
  /**
   * Pede à página que recarregue depois de uma ação. Eram dois callbacks, e o
   * componente ainda lia o detalhe antes de chamá-los: três leituras do mesmo
   * detalhe por ação. Quem lê é a página, uma vez.
   */
  onAtualizada: () => Promise<void> | void
  /** O título do painel, para a página levar o foco até ele (RF-FAT-06). */
  tituloRef?: RefObject<HTMLHeadingElement>
}

export function FaturaDetalhe({
  detalhe,
  cartaoNome,
  cartaoCor,
  anterior,
  proxima,
  onAtualizada,
  tituloRef
}: Props) {
  const {
    fatura,
    parcelas,
    totalCentavos,
    pagoParcialCentavos,
    restanteCentavos,
    excedenteCentavos,
    pagamentosParciais
  } = detalhe
  const kind = fatura.status.kind
  const temParcial = pagoParcialCentavos > 0
  const aviso = avisoDePrazo(fatura, hojeIsoLocal(), quitadaPorParciais(detalhe))

  const [pagando, setPagando] = useState(false)
  const [registrandoParcial, setRegistrandoParcial] = useState(false)
  const [parcelaAdiantar, setParcelaAdiantar] = useState<Parcela | null>(null)
  const [despesaEditar, setDespesaEditar] = useState<Despesa | null>(null)
  const [assinaturaEditar, setAssinaturaEditar] = useState<Despesa | null>(null)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [dialogo, setDialogo] = useState<DialogoConfirma | null>(null)
  const toast = useToast()

  // Com as arquivadas: o modal de edição precisa da categoria atual mesmo
  // arquivada, e é ele quem decide o que oferecer (RF-CAT-02).
  useCargaAuxiliar(
    () => window.api.categoria.list({ incluirArquivados: true }),
    setCategorias,
    'Erro ao listar categorias.'
  )

  const linhas = useMemo(
    () =>
      parcelas.map(
        (parcela): Linha => ({ parcela, despesa: detalhe.despesasPorParcela?.[parcela.id] })
      ),
    [parcelas, detalhe.despesasPorParcela]
  )
  // Abre pela data da compra, crescente: a ordem do extrato do banco.
  const { itensOrdenados, sortBy, sortDir, handleSort } = useOrdenacao(
    linhas,
    COMPARADORES,
    'compra',
    'asc'
  )
  const categoriaPorId = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias])

  function celulaDeCategoria(despesa: Despesa | undefined) {
    if (!despesa) return '—'
    const categoria = categoriaPorId.get(despesa.categoriaId)
    if (!categoria) return `#${despesa.categoriaId}`
    return (
      <RotuloCategoria nome={categoria.nome} arquivada={!categoria.ativo} cor={categoria.cor} />
    )
  }

  // Editar é a primária; Adiantar só existe em parcelada pendente de fatura
  // Aberta, e Excluir remove a despesa inteira — por isso vai no menu, marcada
  // como destrutiva, em vez de repetir um botão solto em cada linha.
  function acoesDaParcela(p: Parcela): AcaoLinha[] {
    const despesa = detalhe.despesasPorParcela?.[p.id]
    const acoes: AcaoLinha[] = []

    // Assinatura abre o modal dela, o mesmo de Saídas. O "Editar" ficava
    // desabilitado aqui ("Assinaturas se editam na tela Saídas"), de quando o
    // modal não era compartilhado. Cancelada não tem Editar, como lá.
    if (p.status === 'Pendente' && despesa?.tipo === 'Assinatura') {
      if (despesa.ativa) {
        acoes.push({
          label: 'Editar',
          onClick: () => setAssinaturaEditar(despesa),
          title: 'Editar assinatura'
        })
      }
    } else if (p.status === 'Pendente' && despesa) {
      acoes.push({
        label: 'Editar',
        onClick: () => setDespesaEditar(despesa),
        title: 'Editar despesa'
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

  const ciclo = useCicloFatura(onAtualizada)
  // O painel fica montado ao trocar de fatura: o erro de uma ação só aparece
  // na fatura em que ela falhou.
  const erroDoCiclo = ciclo.erroDa(fatura.id)

  // No fim da lista a seta acionada fica desabilitada, e botão desabilitado não
  // recebe tecla: o foco passa para a que continua valendo. `useLayoutEffect`
  // para agir antes de o navegador tirar o foco do botão desabilitado.
  const setaAnteriorRef = useRef<HTMLButtonElement>(null)
  const setaProximaRef = useRef<HTMLButtonElement>(null)
  const temAnterior = anterior !== undefined
  const temProxima = proxima !== undefined
  useLayoutEffect(() => {
    const focada = document.activeElement
    if (focada === setaProximaRef.current && !temProxima && temAnterior) {
      setaAnteriorRef.current?.focus()
    } else if (focada === setaAnteriorRef.current && !temAnterior && temProxima) {
      setaProximaRef.current?.focus()
    }
  }, [temAnterior, temProxima])

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
    await onAtualizada()
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
      await onAtualizada()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao atualizar despesa.'), 'error')
      throw e
    }
  }

  // O erro sobe para o modal, que o mostra: como em Saídas.
  async function handleConfirmarEditarAssinatura(input: {
    descricao: string
    categoriaId: number
    valorCentavos: number
  }) {
    if (!assinaturaEditar) return
    await window.api.despesa.atualizar({ despesaId: assinaturaEditar.id, ...input })
    toast.show('Assinatura atualizada.', 'success')
    setAssinaturaEditar(null)
    await onAtualizada()
  }

  async function confirmarExcluirDespesa(despesaId: number) {
    try {
      await window.api.despesa.excluir({ despesaId })
      toast.show('Despesa excluída.', 'success')
      await onAtualizada()
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

  // O erro sobe para o diálogo, que o mostra e segue aberto (RF-FAT-07).
  async function handleRegistrarParcial(input: { valorCentavos: number; dataPagamento: string }) {
    await window.api.fatura.registrarPagamentoParcial({ faturaId: fatura.id, ...input })
    toast.show('Pagamento parcial registrado.', 'success')
    setRegistrandoParcial(false)
    await onAtualizada()
  }

  async function confirmarExcluirPagamento(pagamentoId: number) {
    try {
      await window.api.fatura.excluirPagamentoParcial({ pagamentoId })
      toast.show('Pagamento parcial excluído.', 'success')
      await onAtualizada()
    } catch (e) {
      toast.show(mensagemErro(e, 'Erro ao excluir o pagamento.'), 'error')
    } finally {
      setDialogo(null)
    }
  }

  // Em fatura Paga o Excluir fica desabilitado com o motivo, como o da despesa
  // (RF-DES-09): abrir o diálogo "irreversível" para falhar depois é pior.
  function acoesDoPagamento(pagamento: PagamentoParcial): AcaoLinha[] {
    const paga = kind === 'Paga'
    return [
      {
        label: 'Excluir',
        onClick: () => setDialogo({ tipo: 'excluir-pagamento', pagamento }),
        disabled: paga,
        destrutiva: true,
        title: paga ? 'Reabra a fatura para excluir o pagamento.' : 'Excluir pagamento parcial'
      }
    ]
  }

  return (
    <div className={styles.detalhe}>
      {/* A navegação mora junto do título que ela muda. Eram setas de texto
          nas pontas da largura inteira ("← agosto de 2026"), acima do título,
          e "← sem anterior" era um botão desabilitado com texto. */}
      <div className={styles.cabecalho}>
        <BotaoSeta
          ref={setaAnteriorRef}
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
        {/* `tabIndex={-1}`: o título recebe o foco quando a fatura é aberta
            pelo histórico, sem entrar na ordem do Tab. */}
        <h2 ref={tituloRef} tabIndex={-1} className={styles.detalheTitleText}>
          {cartaoNome} · {formatarMesReferencia(fatura.mesReferencia, { capitalizar: true })}
        </h2>
        <BotaoSeta
          ref={setaProximaRef}
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
          {/* Com pagamento parcial (RN-10) o destaque passa do total para o
              que falta pagar: é o número que o banco cobra. O total continua
              na faixa, porque é dele que os lançamentos abaixo dão conta. */}
          <div className={styles.faixaTotal}>
            <span className={styles.faixaRotulo}>Total da fatura</span>
            <span className={`${temParcial ? styles.faixaValor : styles.faixaTotalValor} tnum`}>
              {formatBRL(totalCentavos)}
            </span>
          </div>
          {temParcial && (
            <>
              <div className={styles.faixaTotal}>
                <span className={styles.faixaRotulo}>Pagamentos parciais</span>
                <span className={`${styles.faixaValor} tnum`}>
                  {formatBRL(pagoParcialCentavos)}
                </span>
              </div>
              <div className={styles.faixaTotal}>
                <span className={styles.faixaRotulo}>
                  {kind === 'Paga' ? 'Restante pago' : 'Falta pagar'}
                </span>
                <span className={`${styles.faixaTotalValor} tnum`}>
                  {formatBRL(restanteCentavos)}
                </span>
              </div>
            </>
          )}
          {kind !== 'Paga' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRegistrandoParcial(true)}
              disabled={ciclo.loading || restanteCentavos === 0}
              title={restanteCentavos === 0 ? 'Não falta nada a pagar nesta fatura.' : undefined}
            >
              Pagamento parcial
            </Button>
          )}
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

        {/* Só acontece quando uma despesa é excluída ou reduzida depois do
            pagamento. A faixa diz quanto, para o pagamento poder ser corrigido. */}
        {excedenteCentavos > 0 && (
          <p className={styles.avisoExcedente} data-tom="atencao">
            {formatBRL(excedenteCentavos)} pagos a mais: os pagamentos parciais passam do total da
            fatura.
          </p>
        )}

        {erroDoCiclo && !pagando && <p className={styles.erroAcao}>{erroDoCiclo}</p>}
      </section>

      {/* Entre a faixa e as parcelas: é a lista que explica os números da
          faixa. Sem pagamento não há painel — a maioria das faturas não tem. */}
      {pagamentosParciais.length > 0 && (
        <Panel
          title="Pagamentos parciais"
          meta={`${pagamentosParciais.length} ${pluralizar('pagamento', pagamentosParciais.length)}`}
          role="region"
          aria-label="Pagamentos parciais"
          flush
        >
          <div className={styles.tabelaWrap}>
            <Table densidade="compacta">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col" className={styles.colValor}>
                    Valor
                  </th>
                  <th scope="col" className={styles.colAcoes}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pagamentosParciais.map((pagamento) => (
                  <tr key={pagamento.id}>
                    <td className="tnum">{formatarDataIso(pagamento.dataPagamento)}</td>
                    <td className={`${styles.colValor} tnum`}>
                      <span className={styles.valor}>{formatBRL(pagamento.valorCentavos)}</span>
                    </td>
                    <td className={styles.colAcoes}>
                      <RowActions
                        acoes={acoesDoPagamento(pagamento)}
                        contexto={`pagamento de ${formatarDataIso(pagamento.dataPagamento)}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Panel>
      )}

      <Panel
        title="Parcelas"
        meta={`${parcelas.length} ${pluralizar('lançamento', parcelas.length)}`}
        flush
      >
        {parcelas.length === 0 ? (
          <EmptyState title="Nenhuma parcela nesta fatura." />
        ) : (
          // O Panel recorta o que passa da borda; aqui o excesso vira
          // rolagem, como em Saídas.
          <div className={styles.tabelaWrap}>
            {/* Compacta, como Saídas e pelo mesmo motivo: uma fatura real
                  passa de 30 lançamentos. */}
            <Table densidade="compacta">
              <thead>
                <tr>
                  <SortableHeader
                    rotulo="Descrição"
                    ativo={sortBy === 'descricao'}
                    direcao={sortDir}
                    onSort={() => handleSort('descricao')}
                    className={styles.colDescricao}
                  />
                  <th scope="col">Categoria</th>
                  <SortableHeader
                    rotulo="Compra"
                    ativo={sortBy === 'compra'}
                    direcao={sortDir}
                    onSort={() => handleSort('compra')}
                    className={styles.colCompra}
                  />
                  <th scope="col">Parcela</th>
                  <SortableHeader
                    rotulo="Valor"
                    ativo={sortBy === 'valor'}
                    direcao={sortDir}
                    onSort={() => handleSort('valor')}
                    className={styles.colValor}
                    alinhamento="direita"
                  />
                  {/* Sem texto visível, mas com nome: "Ações" repetido sobre
                        "Editar" em toda linha era ruído. */}
                  <th scope="col" className={styles.colAcoes}>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensOrdenados.map((linha) => {
                  const { parcela: p, despesa } = linha
                  const ocorrencia = detalhe.ocorrenciaPorParcela?.[p.id]
                  // Sem a descrição do main, cai no número cru.
                  const rotulo =
                    ocorrencia?.rotuloParcela ??
                    (p.total === null ? 'mensal' : `${p.numero}/${p.total}`)
                  return (
                    <tr key={p.id}>
                      <td>{despesa?.descricao ?? `#${p.despesaId}`}</td>
                      <td className={styles.colCategoria}>{celulaDeCategoria(despesa)}</td>
                      <td className={styles.colCompra}>
                        <CelulaDeCompra linha={linha} />
                      </td>
                      <td>
                        <span className={styles.parcelaCelula}>
                          {/* "à vista" é a maioria das linhas e vai em tom
                                de apoio, para "1/6" e "mensal" sobressaírem. */}
                          <span
                            className={`${styles.parcelaRotulo} mono`}
                            data-tom={despesa?.tipo === 'Unica' ? 'apoio' : undefined}
                          >
                            {rotulo}
                          </span>
                          {ocorrencia && ocorrencia.origemCentavos !== null && (
                            <span className={`${styles.origem} tnum`}>
                              de {formatBRL(ocorrencia.origemCentavos)}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={`${styles.colValor} tnum`}>
                        <span className={styles.valor}>{formatBRL(p.valorCentavos)}</span>
                      </td>
                      <td className={styles.colAcoes}>
                        <RowActions acoes={acoesDaParcela(p)} contexto={despesa?.descricao} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
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

      {assinaturaEditar && (
        <EditarAssinaturaModal
          assinatura={assinaturaEditar}
          categorias={categorias}
          onConfirmar={handleConfirmarEditarAssinatura}
          onCancelar={() => setAssinaturaEditar(null)}
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
          pagoParcialCentavos={pagoParcialCentavos}
          restanteCentavos={restanteCentavos}
          loading={ciclo.loading}
          erro={erroDoCiclo}
          onConfirmar={confirmarPagamento}
          onCancelar={() => setPagando(false)}
        />
      )}

      {registrandoParcial && (
        <RegistrarPagamentoParcialModal
          cartaoNome={cartaoNome}
          mesReferencia={fatura.mesReferencia}
          statusFatura={kind}
          restanteCentavos={restanteCentavos}
          onConfirmar={handleRegistrarParcial}
          onCancelar={() => setRegistrandoParcial(false)}
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
          body={`A data de pagamento será apagada. A fatura volta a Aberta — ou a Fechada, se a data de fechamento já tiver passado.${
            temParcial ? ' Os pagamentos parciais são mantidos.' : ''
          }`}
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
      {dialogo?.tipo === 'excluir-pagamento' && (
        <ConfirmDialog
          title="Excluir pagamento parcial?"
          body={`${formatBRL(dialogo.pagamento.valorCentavos)}, pago em ${formatarDataIso(
            dialogo.pagamento.dataPagamento
          )}. O valor volta a contar no que falta pagar desta fatura.`}
          confirmText="Excluir"
          confirmVariant="danger"
          onConfirm={() => confirmarExcluirPagamento(dialogo.pagamento.id)}
          onCancel={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
