import type { Despesa } from '@domain/entities/despesa'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { chaveDeOrigem } from './agrupar-ocorrencias'

const DIACRITICOS = /[̀-ͯ]/g

/** Remove acentos e caixa para busca tolerante (café ≈ cafe ≈ CAFE). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(DIACRITICOS, '').toLowerCase().trim()
}

/**
 * Filtra despesas por trecho da descrição, ignorando acentos e caixa.
 * Busca vazia (ou só espaços) devolve a lista inalterada. Função pura.
 */
export function filtrarPorDescricao<T extends Pick<Despesa, 'descricao'>>(
  itens: readonly T[],
  busca: string
): T[] {
  const alvo = normalizar(busca)
  if (alvo.length === 0) return [...itens]
  return itens.filter((item) => normalizar(item.descricao).includes(alvo))
}

/** Os três tipos que partem o mês: somados, dão a aba "Todas". */
export type TipoDeLancamento = 'avista' | 'parcelada' | 'assinatura'
export type FiltroDeTipo = 'todas' | TipoDeLancamento

/**
 * Estado dos filtros de Saídas (RF-DES-23). String vazia é "todas". A origem
 * usa a chave do agrupamento (`cartao-<id>` ou `fora-do-cartao`) e a categoria
 * o id em texto, que é o que o `<select>` devolve.
 */
export type FiltrosDeSaidas = {
  tipo: FiltroDeTipo
  origem: string
  categoria: string
  tag: string
  busca: string
}

export const FILTROS_PADRAO: FiltrosDeSaidas = {
  tipo: 'todas',
  origem: '',
  categoria: '',
  tag: '',
  busca: ''
}

const TIPO_DA_DESPESA: Record<OcorrenciaDoMes['tipo'], TipoDeLancamento> = {
  Unica: 'avista',
  Parcelada: 'parcelada',
  Assinatura: 'assinatura'
}

/**
 * À vista é a despesa única em qualquer forma de pagamento; assinatura inclui
 * a recorrente sem cartão. As abas antigas misturavam tipo com origem ("Fora
 * do cartão") e não somavam: as compras à vista no crédito não tinham aba.
 */
export function tipoDaOcorrencia(ocorrencia: Pick<OcorrenciaDoMes, 'tipo'>): TipoDeLancamento {
  return TIPO_DA_DESPESA[ocorrencia.tipo]
}

function passaNosFiltros(o: OcorrenciaDoMes, filtros: FiltrosDeSaidas): boolean {
  if (filtros.tipo !== 'todas' && tipoDaOcorrencia(o) !== filtros.tipo) return false
  if (filtros.origem !== '' && chaveDeOrigem(o) !== filtros.origem) return false
  if (filtros.categoria !== '' && String(o.categoriaId) !== filtros.categoria) return false
  if (filtros.tag !== '' && !o.tags.includes(filtros.tag)) return false
  return true
}

/** Os filtros de Saídas combinados por E. Função pura. */
export function filtrarOcorrencias(
  ocorrencias: readonly OcorrenciaDoMes[],
  filtros: FiltrosDeSaidas
): OcorrenciaDoMes[] {
  return filtrarPorDescricao(
    ocorrencias.filter((o) => passaNosFiltros(o, filtros)),
    filtros.busca
  )
}

/**
 * Contagem de cada aba de tipo: o que apareceria se ela fosse clicada. Respeita
 * origem, categoria, tag e busca, mas não o tipo escolhido — senão escolher uma
 * aba zeraria as outras, e elas deixariam de dizer para onde dá para ir.
 */
export function contarPorTipo(
  ocorrencias: readonly OcorrenciaDoMes[],
  filtros: FiltrosDeSaidas
): Record<FiltroDeTipo, number> {
  const base = filtrarOcorrencias(ocorrencias, { ...filtros, tipo: 'todas' })
  const contagem: Record<FiltroDeTipo, number> = {
    todas: base.length,
    avista: 0,
    parcelada: 0,
    assinatura: 0
  }
  for (const o of base) contagem[tipoDaOcorrencia(o)]++
  return contagem
}

/** Se algum filtro está fora do padrão. Busca só de espaços não conta. */
export function temFiltroAtivo(filtros: FiltrosDeSaidas): boolean {
  return (
    filtros.tipo !== 'todas' ||
    filtros.origem !== '' ||
    filtros.categoria !== '' ||
    filtros.tag !== '' ||
    filtros.busca.trim() !== ''
  )
}
