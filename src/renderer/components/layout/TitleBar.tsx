import { useEffect, useState } from 'react'
import { useMatches } from 'react-router-dom'
import { Mark } from '../brand/Mark'
import { Wordmark } from '../brand/Wordmark'
import { RowActions, type AcaoLinha } from '../ui'
import type { Tema } from '@shared/ipc'
import styles from './title-bar.module.css'

function Chevron() {
  return (
    <svg
      viewBox="0 0 10 10"
      width="8"
      height="8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.chevron}
      aria-hidden="true"
    >
      <path d="M1.5 3.5L5 7l3.5-3.5" />
    </svg>
  )
}

function GlifoMinimizar() {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <path d="M0 5h10" />
    </svg>
  )
}

function GlifoMaximizar() {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <rect x=".5" y=".5" width="9" height="9" />
    </svg>
  )
}

function GlifoRestaurar() {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <rect x="0" y="2.5" width="7.5" height="7.5" />
      <path d="M2.5 2.5V0H10v7.5H7.5" />
    </svg>
  )
}

function GlifoFechar() {
  return (
    <svg
      viewBox="0 0 10 10"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      aria-hidden="true"
    >
      <path d="M0 0l10 10M10 0L0 10" />
    </svg>
  )
}

/**
 * Barra de título da janela: a única faixa de cromo acima do conteúdo.
 *
 * Antes eram duas — esta, de 40px, e o `Topbar` de 56px logo abaixo, com o
 * título da página. Fundidas em 32px, devolvem ~56px de altura útil a todas as
 * telas. O `h1` continua sendo o mesmo elemento e o mesmo texto; só mudou de
 * lugar e de tamanho.
 *
 * Os controles de janela deixaram de ser nativos: eram desenhados pelo Windows
 * via `titleBarOverlay`, que impunha o visual do sistema no meio do material do
 * app. Passar a desenhá-los troca acessibilidade e comportamento de graça por
 * código nosso — daí os rótulos, o foco por teclado e o estado de maximizada
 * ouvido do main. Em Linux a moldura nativa permanece e eles não são
 * renderizados, senão a janela teria dois conjuntos.
 */
export function TitleBar() {
  const matches = useMatches()
  const titulo = (matches.at(-1)?.handle as { titulo?: string } | undefined)?.titulo ?? 'Tally'

  const { controlesProprios } = window.api.janela

  // O preload ja carimbou o atributo no <html> antes de a pagina pintar; aqui
  // so espelhamos esse estado para rotular o menu. Ler dele, e nao de um
  // estado proprio, evita as duas fontes de verdade divergirem.
  const [tema, setTema] = useState<Tema>(() => window.api.tema.inicial())
  const [maximizada, setMaximizada] = useState(false)

  // Troca visual primeiro, gravacao depois: o atributo e o que pinta a tela, e
  // esperar o disco para trocar de tema deixaria o clique com latencia de I/O.
  // Se a gravacao falhar, a sessao segue no tema escolhido e o proximo boot
  // volta ao gravado — degrada para o estado antigo, nunca para tela quebrada.
  function alternarTema(): void {
    const proximo: Tema = tema === 'claro' ? 'escuro' : 'claro'
    document.documentElement.setAttribute('data-theme', proximo)
    setTema(proximo)
    void window.api.tema.definir(proximo).catch(() => {})
  }

  useEffect(() => {
    let ativo = true
    window.api.janela
      .estaMaximizada()
      .then((m) => {
        if (ativo) setMaximizada(m)
      })
      .catch(() => {
        // Estado inicial do glifo é cosmético: se a consulta falhar, o botão
        // começa em "Maximizar" e o evento corrige na primeira mudança.
      })
    const cancelar = window.api.janela.aoMudarEstado(setMaximizada)
    return () => {
      ativo = false
      cancelar()
    }
  }, [])

  const acoes: AcaoLinha[] = [
    // O rotulo diz para onde o clique leva, nao onde se esta: um item escrito
    // "Tema claro" enquanto o app esta claro nao diz o que o clique faz.
    { label: tema === 'claro' ? 'Tema escuro' : 'Tema claro', onClick: alternarTema },
    { label: 'Exportar dados…', onClick: () => void window.api.app.exportarDados() },
    { label: 'Importar dados…', onClick: () => void window.api.app.importarDados() },
    {
      label: 'Verificar atualizações…',
      onClick: () => void window.api.app.verificarAtualizacoes()
    },
    { label: 'Sair', onClick: () => void window.api.app.sair(), destrutiva: true }
  ]

  return (
    <div className={styles.barra}>
      {/* `no-drag` é obrigatório em tudo que recebe clique: dentro da região de
          arrasto o clique vira gesto de mover a janela. */}
      <div className={styles.gatilhoBloco} data-arrasto="nao">
        <RowActions
          acoes={acoes}
          visiveis={0}
          rotuloGatilho="Menu do aplicativo"
          alinhamento="esquerda"
          classeGatilho={styles.gatilho}
          conteudoGatilho={
            <>
              <Mark variant="monogram" size={15} />
              <Wordmark size={13} />
              <Chevron />
            </>
          }
        />
      </div>

      <span className={styles.separador} aria-hidden="true" />

      <h1 className={styles.titulo}>{titulo}</h1>

      <div className={styles.espacador} />

      {controlesProprios && (
        <div className={styles.controles} data-arrasto="nao">
          <button
            type="button"
            className={styles.controle}
            onClick={() => void window.api.janela.minimizar()}
            aria-label="Minimizar"
            title="Minimizar"
          >
            <GlifoMinimizar />
          </button>
          <button
            type="button"
            className={styles.controle}
            onClick={() => void window.api.janela.alternarMaximizada()}
            aria-label={maximizada ? 'Restaurar' : 'Maximizar'}
            title={maximizada ? 'Restaurar' : 'Maximizar'}
          >
            {maximizada ? <GlifoRestaurar /> : <GlifoMaximizar />}
          </button>
          <button
            type="button"
            className={`${styles.controle} ${styles.fechar}`}
            onClick={() => void window.api.janela.fechar()}
            aria-label="Fechar"
            title="Fechar"
          >
            <GlifoFechar />
          </button>
        </div>
      )}
    </div>
  )
}
