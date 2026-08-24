import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import { useEscapeKey } from '../../hooks/use-escape-key'
import styles from './row-actions.module.css'

export type AcaoLinha = {
  label: string
  onClick: () => void
  /** Marca a ação como destrutiva: só muda a cor dentro do menu. */
  destrutiva?: boolean
  disabled?: boolean
  title?: string
}

interface RowActionsProps {
  acoes: AcaoLinha[]
  /** Quantas ações ficam como botão visível; o resto vai para o menu. */
  visiveis?: number
  /** Descreve a linha para leitores de tela: "Mais ações de Netflix". */
  contexto?: string
  /**
   * Nome acessível do gatilho. O padrão serve à origem do componente — ações de
   * uma linha —, mas fora de uma tabela ele não diz nada: a barra de título usa
   * este menu e ali não há linha alguma.
   */
  rotuloGatilho?: string
  /**
   * Por qual borda do gatilho o menu é ancorado. `direita` é o padrão porque o
   * componente nasceu na coluna de ações, encostada na borda direita da tabela.
   * Use `esquerda` quando o gatilho ficar no começo da linha — na barra de
   * título, ancorar pela direita jogava o menu para fora da janela.
   */
  alinhamento?: 'direita' | 'esquerda'
}

type Ancora = { topo: number; base: number; direita: number; esquerda: number }

function IconeTresPontos() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  )
}

/**
 * Ações de uma linha de tabela ou lista: as primeiras `visiveis` viram botões e
 * o restante entra num menu "⋯". Substitui a fileira de 4–5 botões que ocupava
 * dois terços da largura da tabela de Saídas e desalinhava as colunas (linhas de
 * assinatura tinham 5 botões; as demais, 4).
 */
export function RowActions({
  acoes,
  visiveis = 1,
  contexto,
  rotuloGatilho = 'Mais ações',
  alinhamento = 'direita'
}: RowActionsProps) {
  const [aberto, setAberto] = useState(false)
  const [ancora, setAncora] = useState<Ancora | null>(null)
  const [alturaMenu, setAlturaMenu] = useState(0)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Ação destrutiva nunca vira botão solto na linha, mesmo que seja a única
  // disponível — é o caso de uma parcela já paga, cuja lista tem só "Excluir".
  const naLinha = acoes.filter((a) => !a.destrutiva).slice(0, visiveis)
  const noMenu = acoes.filter((a) => !naLinha.includes(a))

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false)
    if (devolverFoco) triggerRef.current?.focus()
  }, [])

  useEscapeKey(
    useCallback(() => {
      if (aberto) fechar()
    }, [aberto, fechar])
  )

  // Âncora medida no clique, e não num efeito: o menu só entra no DOM quando
  // ela existe, então calcular depois deixava o portal vazio no render em que o
  // efeito de foco roda — e o foco nunca chegava ao primeiro item.
  function abrir() {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r)
      setAncora({
        topo: r.top,
        base: r.bottom,
        direita: window.innerWidth - r.right,
        esquerda: r.left
      })
    setAlturaMenu(0)
    setAberto(true)
  }

  // Segunda passada, antes do paint: com a altura real do menu dá para decidir
  // se ele cabe abaixo do gatilho. Sem isso, uma linha perto do rodapé abria o
  // menu fora da viewport — e ele ficava inalcançável por clique.
  useLayoutEffect(() => {
    if (!aberto || !menuRef.current) return
    setAlturaMenu(menuRef.current.offsetHeight)
  }, [aberto])

  const posicao = ancora
    ? {
        top:
          ancora.base + 4 + alturaMenu <= window.innerHeight - 8
            ? ancora.base + 4
            : Math.max(8, ancora.topo - 4 - alturaMenu),
        ...(alinhamento === 'esquerda' ? { left: ancora.esquerda } : { right: ancora.direita })
      }
    : null

  useEffect(() => {
    if (!aberto) return
    // Reposicionar, e não fechar: fechar em qualquer resize deixava o menu à
    // mercê dos eventos tardios que o setSize do Electron emite, e o menu sumia
    // logo depois de abrir. Só fecha se o gatilho sair da viewport, quando
    // manter o menu flutuando solto seria pior.
    function reposicionar() {
      const r = triggerRef.current?.getBoundingClientRect()
      if (!r) return
      if (r.bottom < 0 || r.top > window.innerHeight) {
        fechar(false)
        return
      }
      setAncora({
        topo: r.top,
        base: r.bottom,
        direita: window.innerWidth - r.right,
        esquerda: r.left
      })
    }
    function aoClicarFora(e: MouseEvent) {
      const alvo = e.target as Node
      if (menuRef.current?.contains(alvo) || triggerRef.current?.contains(alvo)) return
      fechar(false)
    }
    window.addEventListener('scroll', reposicionar, true)
    window.addEventListener('resize', reposicionar)
    document.addEventListener('mousedown', aoClicarFora)
    return () => {
      window.removeEventListener('scroll', reposicionar, true)
      window.removeEventListener('resize', reposicionar)
      document.removeEventListener('mousedown', aoClicarFora)
    }
  }, [aberto, fechar])

  useEffect(() => {
    if (!aberto) return
    const primeiro = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    primeiro?.focus()
  }, [aberto])

  function navegarComTeclado(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
    e.preventDefault()
    const itens = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    ].filter((b) => !b.disabled)
    if (itens.length === 0) return
    const atual = itens.indexOf(document.activeElement as HTMLButtonElement)
    const proximo =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? itens.length - 1
          : e.key === 'ArrowDown'
            ? (atual + 1) % itens.length
            : (atual - 1 + itens.length) % itens.length
    itens[proximo]?.focus()
  }

  function acionar(acao: AcaoLinha) {
    fechar()
    acao.onClick()
  }

  return (
    <div className={styles.root}>
      {naLinha.map((acao) => (
        <Button
          key={acao.label}
          variant="ghost"
          size="sm"
          onClick={acao.onClick}
          disabled={acao.disabled}
          title={acao.title}
        >
          {acao.label}
        </Button>
      ))}

      {noMenu.length > 0 && (
        <button
          ref={triggerRef}
          type="button"
          className={styles.trigger}
          aria-haspopup="menu"
          aria-expanded={aberto}
          // O contexto vai no menu, não aqui: como `aria-label` de descendente
          // entra no nome acessível da célula, pôr a descrição da linha no
          // gatilho fazia a célula de ações colidir com a da descrição.
          aria-label={rotuloGatilho}
          onClick={() => (aberto ? fechar() : abrir())}
        >
          <IconeTresPontos />
        </button>
      )}

      {aberto &&
        posicao &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={contexto ? `Ações de ${contexto}` : 'Ações da linha'}
            className={styles.menu}
            style={posicao}
            onKeyDown={navegarComTeclado}
          >
            {noMenu.map((acao, i) => {
              const abreBlocoDestrutivo = acao.destrutiva && i > 0 && !noMenu[i - 1]?.destrutiva
              return (
                // Fragment, não <div>: menuitem precisa ser filho direto de
                // role="menu" (aria-required-children), e o separador tem
                // role="separator", que é filho válido.
                <Fragment key={acao.label}>
                  {abreBlocoDestrutivo && <div role="separator" className={styles.separador} />}
                  <button
                    type="button"
                    role="menuitem"
                    className={`${styles.item} ${acao.destrutiva ? styles.destrutivo : ''}`}
                    disabled={acao.disabled}
                    title={acao.title}
                    onClick={() => acionar(acao)}
                  >
                    {acao.label}
                  </button>
                </Fragment>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
