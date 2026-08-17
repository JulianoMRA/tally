import { useRef } from 'react'
import styles from './segmented-control.module.css'

export type OpcaoSegmentada<T extends string | number> = {
  valor: T
  rotulo: string
}

interface SegmentedControlProps<T extends string | number> {
  opcoes: readonly OpcaoSegmentada<T>[]
  valor: T
  onChange: (valor: T) => void
  /** Obrigatório: sem ele o grupo não tem nome acessível. */
  label: string
  size?: 'sm' | 'md'
  /**
   * `opcoes` (padrão) escolhe um valor — vira `radiogroup`. `abas` troca o
   * conteúdo visível da tela — vira `tablist`.
   */
  semantica?: 'opcoes' | 'abas'
  /**
   * `pilula` (padrão) é a barra compacta. `cartoes` espalha as opções como
   * blocos de alvo grande, para escolha que abre um formulário diferente a
   * cada valor — é o caso de forma de pagamento, onde a pílula escondia que a
   * escolha muda quais campos existem. Só o visual muda: papéis, nomes
   * acessíveis e teclado são os mesmos.
   */
  variante?: 'pilula' | 'cartoes'
}

/**
 * Escolha única em formato de pílula. Substitui seis implementações
 * praticamente idênticas espalhadas pelas features (tipo e forma de pagamento
 * no formulário de despesa, abas e filtro de status em Rendas, filtros de
 * Saídas, escopo do orçamento e período dos gráficos), que variavam só no
 * padding e não tinham semântica nenhuma — eram `<button>` soltos, anunciados
 * como "botão" sem indicar que formam um grupo nem qual está escolhido.
 */
export function SegmentedControl<T extends string | number>({
  opcoes,
  valor,
  onChange,
  label,
  size = 'sm',
  semantica = 'opcoes',
  variante = 'pilula'
}: SegmentedControlProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null)
  const ehAbas = semantica === 'abas'

  // Setas navegam entre as opções, como manda o padrão de radiogroup/tablist.
  function navegar(e: React.KeyboardEvent<HTMLDivElement>) {
    const teclas = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
    if (!teclas.includes(e.key)) return
    e.preventDefault()
    const atual = opcoes.findIndex((o) => o.valor === valor)
    const ultimo = opcoes.length - 1
    const proximo =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? ultimo
          : e.key === 'ArrowRight' || e.key === 'ArrowDown'
            ? (atual + 1) % opcoes.length
            : (atual - 1 + opcoes.length) % opcoes.length

    onChange(opcoes[proximo].valor)
    const botoes = rootRef.current?.querySelectorAll('button')
    botoes?.[proximo]?.focus()
  }

  return (
    <div
      ref={rootRef}
      role={ehAbas ? 'tablist' : 'radiogroup'}
      aria-label={label}
      className={`${styles.root} ${variante === 'cartoes' ? styles.rootCartoes : ''}`}
      onKeyDown={navegar}
    >
      {opcoes.map((opcao) => {
        const ativa = opcao.valor === valor
        return (
          <button
            key={String(opcao.valor)}
            type="button"
            role={ehAbas ? 'tab' : 'radio'}
            aria-selected={ehAbas ? ativa : undefined}
            aria-checked={ehAbas ? undefined : ativa}
            // Roving tabindex: o grupo inteiro é uma parada de Tab, e as setas
            // movem dentro dele.
            tabIndex={ativa ? 0 : -1}
            className={`${styles.opcao} ${variante === 'cartoes' ? styles.cartao : styles[size]} ${ativa ? styles.ativa : ''}`}
            onClick={() => onChange(opcao.valor)}
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
