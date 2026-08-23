import { mesReferenciaAnterior, proxMesReferencia } from '@domain/services/mes-referencia'
import { Input } from './Input'
import styles from './seletor-mes.module.css'

interface SeletorMesProps {
  /** Mês de referência no formato YYYY-MM. */
  valor: string
  onChange: (mes: string) => void
  /**
   * Nome acessível do campo. Omita quando o seletor já estiver dentro de um
   * `Field` — lá o rótulo visível é quem nomeia, e um aria-label aqui o
   * sobrescreveria.
   */
  label?: string
  /** Preenchido pelo `Field`, que associa o rótulo ao campo por este id. */
  id?: string
  className?: string
}

/**
 * Campo de mês com passadores de mês anterior e próximo. Era o mesmo bloco
 * repetido em Visão mensal e Saídas — markup igual e CSS copiado nos dois
 * módulos, divergindo só na largura do campo e na guarda do campo esvaziado,
 * que só uma das telas tinha.
 */
export function SeletorMes({ valor, onChange, label, id, className }: SeletorMesProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => onChange(mesReferenciaAnterior(valor))}
        aria-label="Mês anterior"
      >
        ←
      </button>
      <Input
        id={id}
        type="month"
        value={valor}
        // Campo esvaziado devolve '' e a tela consultaria um mês inexistente.
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className={styles.mesInput}
        aria-label={label}
      />
      <button
        type="button"
        className={styles.navBtn}
        onClick={() => onChange(proxMesReferencia(valor))}
        aria-label="Próximo mês"
      >
        →
      </button>
    </div>
  )
}
