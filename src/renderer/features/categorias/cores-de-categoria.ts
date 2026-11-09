import type { SugestaoDeCor } from '../../components/ui'

/**
 * Sugestões do seletor de cor no cadastro de categoria, em ordem de matiz.
 *
 * A categoria guarda uma cor só para os dois temas, e ela vira fatia da pizza,
 * barra do ranking e bolinha nas listas, sempre sobre card. Por isso cada cor
 * fica numa faixa estreita de luminosidade (OKLCH L entre ~0,52 e ~0,64), a que
 * dá 3:1 contra o card claro e o escuro, com croma de 0,10 para cima, para não
 * se ler como cinza nem se confundir com a fatia "Outros". O guard está em
 * `styles/__tests__/contraste.test.ts`.
 *
 * Faixa estreita tem preço: com onze cores, os pares vizinhos de matiz ficam
 * próximos (o mais próximo é Oliva e Verde). As telas sempre mostram o nome ao
 * lado da cor, e é isso que identifica a categoria.
 */
export const CORES_DE_CATEGORIA: readonly SugestaoDeCor[] = [
  { hex: '#ae4b21', nome: 'Ferrugem' },
  { hex: '#c37708', nome: 'Âmbar' },
  { hex: '#779533', nome: 'Oliva' },
  { hex: '#108035', nome: 'Verde' },
  { hex: '#039c8e', nome: 'Verde-água' },
  { hex: '#087399', nome: 'Petróleo' },
  { hex: '#438eda', nome: 'Azul' },
  { hex: '#6761c4', nome: 'Índigo' },
  { hex: '#b570ca', nome: 'Violeta' },
  { hex: '#9b4f7f', nome: 'Ameixa' },
  { hex: '#d76177', nome: 'Rosa' }
]

/** Padrão da categoria nova: a primeira sugestão, em vez do `#000000` do input nativo. */
export const COR_PADRAO_DE_CATEGORIA = CORES_DE_CATEGORIA[0].hex
