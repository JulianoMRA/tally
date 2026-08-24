import { RowActions, type AcaoLinha } from '../ui'
import styles from './title-bar.module.css'

/**
 * Barra de título da janela.
 *
 * Substitui as duas faixas de cromo que ficavam acima do conteúdo — a barra de
 * título nativa e a barra de menu —, que juntas empurravam o app para baixo e
 * faziam o nome "Tally" aparecer duas vezes, já que a `Sidebar` também o exibe.
 * Por isso ela é deliberadamente muda: só arrasto, o menu e o espaço reservado
 * aos controles de janela.
 *
 * Os controles (minimizar, maximizar, fechar) continuam **nativos**: no Windows
 * o `titleBarOverlay` os desenha por cima desta barra, no canto que o
 * `env(titlebar-area-*)` reserva. Não reimplementamos nem eles nem sua
 * acessibilidade.
 */
export function TitleBar() {
  const acoes: AcaoLinha[] = [
    { label: 'Exportar dados…', onClick: () => void window.api.app.exportarDados() },
    { label: 'Importar dados…', onClick: () => void window.api.app.importarDados() },
    {
      label: 'Verificar atualizações…',
      onClick: () => void window.api.app.verificarAtualizacoes()
    },
    { label: 'Sair', onClick: () => void window.api.app.sair() }
  ]

  return (
    <div className={styles.barra}>
      {/* `data-arrasto="nao"` marca o que precisa continuar clicável: dentro da
          região de arrasto, um clique vira gesto de mover a janela e o botão
          nunca abriria. */}
      <div className={styles.acoes} data-arrasto="nao">
        <RowActions
          acoes={acoes}
          visiveis={0}
          rotuloGatilho="Menu do aplicativo"
          alinhamento="esquerda"
        />
      </div>
    </div>
  )
}
