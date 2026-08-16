import { useId, type ReactNode } from 'react'
import { useEscapeKey } from '../../hooks/use-escape-key'
import { useFocusTrap } from '../../hooks/use-focus-trap'
import styles from './side-panel.module.css'

type Props = {
  titulo: string
  /** Linha de apoio sob o título. Vira o `aria-describedby` do diálogo. */
  descricao?: string
  onFechar: () => void
  children: ReactNode
  /** Barra fixa no rodapé — é onde vivem os botões de salvar e cancelar. */
  rodape?: ReactNode
  /**
   * Clicar no overlay fecha. Desligue quando o painel carrega formulário com
   * dado digitado: descartar meia despesa por um clique fora é o mesmo risco
   * que fez o `ConfirmDialog` travar o overlay em ação destrutiva.
   */
  fecharNoOverlay?: boolean
}

function IconeFechar() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/**
 * Painel lateral sobreposto. É o "formulário é episódio" do refactor visual:
 * cadastro sai do layout permanente e passa a abrir sob demanda, devolvendo a
 * largura inteira para a lista — que é o que se consulta o tempo todo.
 *
 * Quem controla a abertura é o pai, renderizando ou não o componente, igual ao
 * `ConfirmDialog`. Não há prop `aberto`: montar só quando visível garante que o
 * formulário nasce limpo a cada abertura e que o foco entra de fato.
 *
 * Deliberadamente sempre overlay, nunca coluna. A proposta desenhou o painel
 * como coluna de 440px ao lado da lista, mas isso pressupõe os 1906px do
 * mockup: na janela padrão sobram ~1058px de conteúdo, e uma coluna de 440
 * deixaria 618px para a tabela de Saídas, menos que os ~698px que ela precisa —
 * a mesma conta que já empurrou o breakpoint daquela tela para 1400px.
 */
export function SidePanel({
  titulo,
  descricao,
  onFechar,
  children,
  rodape,
  fecharNoOverlay = true
}: Props) {
  const tituloId = useId()
  const descricaoId = useId()
  const painelRef = useFocusTrap<HTMLDivElement>()
  useEscapeKey(onFechar)

  return (
    <div className={styles.overlay} onClick={fecharNoOverlay ? onFechar : undefined}>
      <div
        ref={painelRef}
        className={styles.painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricao ? descricaoId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.cabecalho}>
          <div className={styles.tituloBloco}>
            <h2 id={tituloId} className={styles.titulo}>
              {titulo}
            </h2>
            {descricao && (
              <p id={descricaoId} className={styles.descricao}>
                {descricao}
              </p>
            )}
          </div>
          <button
            type="button"
            className={styles.fechar}
            onClick={onFechar}
            aria-label={`Fechar ${titulo}`}
          >
            <IconeFechar />
          </button>
        </header>

        <div className={styles.corpo}>{children}</div>

        {rodape && <footer className={styles.rodape}>{rodape}</footer>}
      </div>
    </div>
  )
}
