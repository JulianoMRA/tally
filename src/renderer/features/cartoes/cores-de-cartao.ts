import type { SugestaoDeCor } from '../../components/ui'

/**
 * Sugestões do seletor de cor no cadastro de cartão. Trazem as cores dos
 * bancos (roxo do Nubank, laranja do Inter): a cor do cartão é a da marca, e
 * não uma série de gráfico como a da categoria.
 */
export const CORES_DE_CARTAO: readonly SugestaoDeCor[] = [
  { hex: '#0f1a14', nome: 'Verde escuro' },
  { hex: '#5b7a5e', nome: 'Verde sálvia' },
  { hex: '#3f6e47', nome: 'Verde' },
  { hex: '#a88454', nome: 'Bronze' },
  { hex: '#a87b2c', nome: 'Âmbar' },
  { hex: '#8c3b2e', nome: 'Terracota' },
  { hex: '#5a4a8a', nome: 'Roxo' },
  { hex: '#820ad1', nome: 'Roxo vivo' },
  { hex: '#ff7a00', nome: 'Laranja' },
  { hex: '#1f6f8b', nome: 'Azul' }
]

/** Padrão do cartão novo: a primeira sugestão, em vez do `#000000` do input nativo. */
export const COR_PADRAO_DE_CARTAO = CORES_DE_CARTAO[0].hex
