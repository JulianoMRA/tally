import { useId, type ReactNode } from 'react'
import { useEscapeKey } from '../../hooks/use-escape-key'
import { useFocusTrap } from '../../hooks/use-focus-trap'
import styles from './modal.module.css'

type Props = {
  titulo: string
  /**
   * Linha de apoio sob o título. Vira o `aria-describedby` do diálogo.
   * `ReactNode`, e não `string` como no `SidePanel`, porque parte dos modais
   * destaca um trecho (`<strong>{descricao}</strong> — {valor}`).
   */
  descricao?: ReactNode
  onFechar: () => void
  children: ReactNode
  /** Linha de botões ao pé do diálogo — tipicamente Cancelar e a ação primária. */
  rodape?: ReactNode
  /**
   * Diferente do `SidePanel`, aqui o padrão é **não** fechar no clique do
   * overlay: todos os modais do app carregam formulário com dado digitado, e
   * descartá-lo por um clique fora é o risco que já travou o overlay do
   * `ConfirmDialog` em ação destrutiva. Ligue só onde não houver o que perder.
   */
  fecharNoOverlay?: boolean
  /**
   * `ampla` existe para o modal de nota e tags, que empilha textarea, chips e
   * campo de entrada. As larguras eram 360, 360, 380 e 420 espalhadas por
   * quatro módulos, sem critério — viraram dois degraus.
   */
  largura?: 'padrao' | 'ampla'
}

/**
 * Diálogo centrado. Absorve o esqueleto que estava copiado em seis modais de
 * feature — overlay, armadilha de foco, Esc, `role`/`aria` e a linha de ações —,
 * junto com o CSS `.modalOverlay`/`.modal`/`.modalTitle`/`.modalActions`
 * duplicado em quatro módulos.
 *
 * Quem controla a abertura é o pai, renderizando ou não o componente, igual ao
 * `SidePanel` e ao `ConfirmDialog`. Não há prop `aberto`: montar só quando
 * visível garante que o formulário nasce limpo e que o foco entra de fato.
 *
 * `SidePanel` continua sendo a casa do cadastro, que é episódio longo e ocupa a
 * lateral inteira. `Modal` é para a interação curta e focada — confirmar uma
 * data, ajustar um valor, editar metadado.
 */
export function Modal({
  titulo,
  descricao,
  onFechar,
  children,
  rodape,
  fecharNoOverlay = false,
  largura = 'padrao'
}: Props) {
  const tituloId = useId()
  const descricaoId = useId()
  const dialogoRef = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onFechar)

  return (
    <div className={styles.overlay} onClick={fecharNoOverlay ? onFechar : undefined}>
      <div
        ref={dialogoRef}
        className={`${styles.dialogo} ${largura === 'ampla' ? styles.ampla : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao ? descricaoId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId} className={styles.titulo}>
          {titulo}
        </h2>
        {descricao && (
          <p id={descricaoId} className={styles.descricao}>
            {descricao}
          </p>
        )}

        {children}

        {rodape && <div className={styles.acoes}>{rodape}</div>}
      </div>
    </div>
  )
}
