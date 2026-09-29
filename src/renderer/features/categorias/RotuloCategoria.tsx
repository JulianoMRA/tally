import { Badge, BolinhaDeCor } from '../../components/ui'
import styles from './categorias.module.css'

type Props = {
  nome: string
  arquivada: boolean
  /**
   * Cor da categoria. Saídas passa: é a mesma cor do ranking e da pizza da
   * Visão mensal, e reconhecer a categoria por ela liga as telas. A Busca não
   * passa — lá a lista é consulta, não operação do mês.
   */
  cor?: string
}

/**
 * Categoria de um lançamento numa tabela. A arquivada continua com o nome e
 * ganha o selo (RF-CAT-02) — antes, Saídas e Busca carregavam só as ativas, e
 * a parcela de uma categoria arquivada aparecia como "#7".
 */
export function RotuloCategoria({ nome, arquivada, cor }: Props) {
  return (
    <span className={styles.rotuloCategoria}>
      {cor && <BolinhaDeCor cor={cor} />}
      {nome}
      {arquivada && <Badge variant="archived" label="Arquivada" />}
    </span>
  )
}
