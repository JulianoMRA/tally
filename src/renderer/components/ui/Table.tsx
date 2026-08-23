import type { ReactNode } from 'react'
import styles from './table.module.css'

type Props = {
  children: ReactNode
  /**
   * `compacta` é o degrau de célula que Saídas adotou na v1.5.1 — num mês com
   * 15 parceladas recupera mais de uma tela de rolagem. As demais tabelas ficam
   * no padrão.
   */
  densidade?: 'padrao' | 'compacta'
  className?: string
}

/**
 * Tabela do design system. O estilo estava duplicado **byte a byte** entre
 * `faturas` e `visao-mensal` — dez declarações idênticas só no `th` —, com
 * `saidas` carregando uma terceira variante que difere de propósito.
 *
 * Fora daqui de propósito: `print-mensal.module.css`, que é folha de impressão
 * com medidas em px e outra escala, e a `.tabelaErros` de Importar, que é uma
 * tabelinha de diagnóstico e não uma tabela de dados da aplicação.
 */
export function Table({ children, densidade = 'padrao', className }: Props) {
  const cls = [styles.tabela, densidade === 'compacta' ? styles.compacta : '', className]
    .filter(Boolean)
    .join(' ')
  return <table className={cls}>{children}</table>
}
