import { forwardRef } from 'react'
import styles from './botao-seta.module.css'

type Props = {
  direcao: 'anterior' | 'proxima'
  /** Nome acessível e dica: diz para onde a seta leva ("Fatura anterior: agosto de 2026"). */
  rotulo: string
  onClick?: () => void
  disabled?: boolean
}

/**
 * Seta de navegação entre períodos. Saiu do `SeletorMes` para a navegação de
 * faturas usar o mesmo botão: eram setas de texto soltas nas pontas da página
 * ("← agosto de 2026", "outubro de 2026 →"), longe do título que elas mudam.
 *
 * A ref existe para quem precisa passar o foco de uma seta para a outra: no
 * fim da lista a seta acionada fica desabilitada, e botão desabilitado não
 * recebe tecla.
 */
export const BotaoSeta = forwardRef<HTMLButtonElement, Props>(function BotaoSeta(
  { direcao, rotulo, onClick, disabled },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.seta}
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
    >
      {direcao === 'anterior' ? '←' : '→'}
    </button>
  )
})
