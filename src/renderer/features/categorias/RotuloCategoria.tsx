import { Badge } from '../../components/ui'
import styles from './categorias.module.css'

type Props = {
  nome: string
  arquivada: boolean
}

/**
 * Categoria de um lançamento numa tabela. A arquivada continua com o nome e
 * ganha o selo (RF-CAT-02) — antes, Saídas e Busca carregavam só as ativas, e
 * a parcela de uma categoria arquivada aparecia como "#7".
 */
export function RotuloCategoria({ nome, arquivada }: Props) {
  return (
    <span className={styles.rotuloCategoria}>
      {nome}
      {arquivada && <Badge variant="archived" label="Arquivada" />}
    </span>
  )
}
