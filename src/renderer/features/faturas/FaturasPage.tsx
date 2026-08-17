import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCartoesAtivos } from '../despesas/hooks/use-cartoes-ativos'
import { useFaturaDetalhe, useFaturasDeTodosCartoes } from './hooks/use-faturas'
import { FaturaDetalhe } from './FaturaDetalhe'
import { HistoricoFaturas } from './HistoricoFaturas'
import { TrilhoCartoes } from './TrilhoCartoes'
import { PageContainer } from '../../components/layout/PageContainer'
import { PageHead } from '../../components/layout/PageHead'
import { Button, EmptyState } from '../../components/ui'
import { formatarMesReferencia } from '../../lib/formatar-data'
import { mesAtualReferencia } from '../../lib/mes-atual'
import { buildFaturasSearch, parseFaturasSearch } from './faturas-search'
import { resolverFaturaDoDeepLink } from './escolher-fatura-corrente'
import styles from './faturas.module.css'

/**
 * Lista e detalhe numa tela só (pontos 12, 13 e 14).
 *
 * Antes eram três cliques até a fatura atual: select de cartão → lista agrupada
 * por cartão (que repetia o select) → item. Agora o trilho mostra a situação de
 * cada cartão e o painel já abre na fatura corrente do cartão em foco.
 *
 * O deep-link `?cartaoId=&faturaId=` sobrevive com o mesmo formato, então links
 * salvos continuam abrindo. O que mudou é o significado: `faturaId` diz qual
 * fatura o painel exibe, não mais "abre no modo detalhe" — não existe mais um
 * modo lista para contrastar.
 */
export default function FaturasPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Lê o deep-link uma vez na montagem; daí em diante o estado é a fonte de
  // verdade e os handlers reescrevem a URL (replace).
  const [pedido] = useState(() => parseFaturasSearch(searchParams))
  const [cartaoId, setCartaoId] = useState<number | null>(pedido.cartaoId)
  const [faturaId, setFaturaId] = useState<number | null>(pedido.faturaId)
  const [linkQuebrado, setLinkQuebrado] = useState(false)

  const { cartoes, loading: loadingCartoes } = useCartoesAtivos()
  const {
    grupos,
    loading: loadingGrupos,
    refetch: refetchGrupos
  } = useFaturasDeTodosCartoes(cartoes)

  const mesAtual = mesAtualReferencia()

  const cartaoEmFoco = useMemo(() => {
    if (cartaoId !== null && grupos.some((g) => g.cartao.id === cartaoId)) return cartaoId
    return grupos[0]?.cartao.id ?? null
  }, [cartaoId, grupos])

  const grupoEmFoco = useMemo(
    () => grupos.find((g) => g.cartao.id === cartaoEmFoco) ?? null,
    [grupos, cartaoEmFoco]
  )

  // O `?faturaId=` da URL é consumido uma única vez. Depois disso, trocar de
  // cartão sempre cai na fatura corrente dele — carregar a intenção do link
  // adiante faria o id de um cartão ser procurado no outro.
  const [deepLinkPendente, setDeepLinkPendente] = useState(pedido.faturaId !== null)

  // Um `faturaId` que já pertence ao cartão em foco é preservado — é o caso de
  // quem acabou de clicar no histórico. Fora isso, precisa resolver.
  //
  // Esta condição entra nas deps do efeito de propósito: sem ela, zerar o
  // `faturaId` com o mesmo cartão em foco não mudava `grupoEmFoco`, o efeito
  // não re-rodava e o painel ficava preso em "Nenhuma fatura neste cartão"
  // enquanto o trilho exibia a fatura logo acima.
  const precisaResolver =
    grupoEmFoco !== null && !grupoEmFoco.faturas.some((f) => f.fatura.id === faturaId)

  useEffect(() => {
    if (!grupoEmFoco || !precisaResolver) return

    const resolucao = resolverFaturaDoDeepLink(
      grupoEmFoco.faturas,
      deepLinkPendente ? pedido.faturaId : null,
      mesAtual
    )
    setFaturaId(resolucao.fatura?.fatura.id ?? null)
    if (resolucao.linkQuebrado) setLinkQuebrado(true)
    if (deepLinkPendente) setDeepLinkPendente(false)
    // `faturaId` fora das deps de propósito: este efeito o DEFINE, e quem
    // observa a necessidade de resolver é `precisaResolver`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoEmFoco, mesAtual, deepLinkPendente, precisaResolver])

  const { detalhe, loading: loadingDetalhe, refetch: refetchDetalhe } = useFaturaDetalhe(faturaId)

  // Mantém a URL em dia sem criar entrada de histórico.
  useEffect(() => {
    if (cartaoEmFoco !== null && faturaId !== null) {
      setSearchParams(buildFaturasSearch(cartaoEmFoco, faturaId), { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartaoEmFoco, faturaId])

  function selecionarCartao(proximo: number) {
    // Clicar no cartão que já está em foco não deve descartar a fatura aberta.
    if (proximo === cartaoEmFoco) return
    setCartaoId(proximo)
    setFaturaId(null)
    setLinkQuebrado(false)
  }

  function abrirFatura(id: number) {
    setFaturaId(id)
    setLinkQuebrado(false)
  }

  // Faturas futuras saíram da lista (ponto 13) e são alcançadas por aqui. A
  // navegação anda pelas faturas QUE EXISTEM, em ordem de mês, em vez de somar
  // mês no calendário: cartão sem compra num mês não tem fatura, e um ‹ › que
  // caísse em mês vazio não teria o que mostrar.
  const ordenadas = useMemo(
    () =>
      [...(grupoEmFoco?.faturas ?? [])].sort((a, b) =>
        a.mesReferencia.localeCompare(b.mesReferencia)
      ),
    [grupoEmFoco]
  )
  const indiceAtual = ordenadas.findIndex((f) => f.fatura.id === faturaId)
  const anterior = indiceAtual > 0 ? ordenadas[indiceAtual - 1] : undefined
  const proxima =
    indiceAtual >= 0 && indiceAtual < ordenadas.length - 1 ? ordenadas[indiceAtual + 1] : undefined

  const carregando = loadingCartoes || loadingGrupos

  return (
    <PageContainer>
      <PageHead
        title="Faturas"
        subtitle="Situação de cada cartão e as parcelas da fatura em foco."
      />

      <div className={styles.corpo}>
        {carregando && <p className={styles.empty}>Carregando…</p>}

        {!carregando && grupos.length === 0 && (
          <EmptyState
            title="Nenhum cartão cadastrado"
            description="Cadastre um cartão para que as faturas comecem a ser geradas."
          />
        )}

        {!carregando && grupos.length > 0 && (
          <>
            <TrilhoCartoes
              grupos={grupos}
              cartaoSelecionadoId={cartaoEmFoco}
              onSelecionar={selecionarCartao}
            />

            {linkQuebrado && (
              <p className={styles.avisoLinkQuebrado}>
                A fatura desse link não existe mais. Abrimos a fatura atual do cartão.
              </p>
            )}

            {faturaId === null && (
              <EmptyState
                title="Nenhuma fatura neste cartão"
                description="Registre uma despesa no crédito para gerar a primeira fatura."
              />
            )}

            {faturaId !== null && loadingDetalhe && <p className={styles.empty}>Carregando…</p>}

            {faturaId !== null && !loadingDetalhe && detalhe && grupoEmFoco && (
              <>
                <div className={styles.navMes}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!anterior}
                    onClick={() => anterior && abrirFatura(anterior.fatura.id)}
                  >
                    ← {anterior ? formatarMesReferencia(anterior.mesReferencia) : 'sem anterior'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!proxima}
                    onClick={() => proxima && abrirFatura(proxima.fatura.id)}
                  >
                    {proxima ? formatarMesReferencia(proxima.mesReferencia) : 'sem próxima'} →
                  </Button>
                </div>
                <FaturaDetalhe
                  detalhe={detalhe}
                  cartaoNome={grupoEmFoco.cartao.nome}
                  cartaoCor={grupoEmFoco.cartao.cor}
                  onFaturaAtualizada={() => {
                    refetchGrupos()
                    refetchDetalhe()
                  }}
                  onDetalheAtualizado={refetchDetalhe}
                />
              </>
            )}

            {grupoEmFoco && (
              <HistoricoFaturas
                faturas={grupoEmFoco.faturas}
                mesAtual={mesAtual}
                faturaAbertaId={faturaId}
                cartaoCor={grupoEmFoco.cartao.cor}
                onAbrir={abrirFatura}
              />
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
