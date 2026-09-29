import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { ordenarParaFiltro, rotuloDeCategoria } from '../../lib/categorias'
import { FORA_DO_CARTAO, chaveDeOrigem } from './agrupar-ocorrencias'

export type OpcaoDeFiltro = { valor: string; rotulo: string }

/*
 * As opções de cada select vêm do MÊS, não do cadastro: oferecer um cartão ou
 * uma categoria sem lançamento só levaria a uma lista vazia.
 *
 * E o valor escolhido sempre entra, mesmo ausente do mês. Os filtros
 * sobrevivem à troca de mês (acompanhar "Lazer" mês a mês), e um `<select>`
 * controlado cujo valor não está entre as opções mostra a primeira delas —
 * "Todas" — enquanto filtra. Foi assim que o filtro de tag deixava a lista
 * vazia sem nada na tela que explicasse.
 */

function porRotulo(a: OpcaoDeFiltro, b: OpcaoDeFiltro): number {
  return a.rotulo.localeCompare(b.rotulo, 'pt-BR')
}

/** Cartões em ordem alfabética, e "Fora do cartão" por último. */
export function opcoesDeOrigem(
  ocorrencias: readonly OcorrenciaDoMes[],
  cartoes: readonly Cartao[],
  selecionada: string
): OpcaoDeFiltro[] {
  const chaves = new Set(ocorrencias.map(chaveDeOrigem))
  if (selecionada !== '') chaves.add(selecionada)

  const nomePorId = new Map(cartoes.map((c) => [c.id, c.nome]))
  const doCartao = [...chaves]
    .filter((chave) => chave !== FORA_DO_CARTAO)
    .map((chave) => {
      const id = Number(chave.slice('cartao-'.length))
      return { valor: chave, rotulo: nomePorId.get(id) ?? `#${id}` }
    })
    .sort(porRotulo)

  return chaves.has(FORA_DO_CARTAO)
    ? [...doCartao, { valor: FORA_DO_CARTAO, rotulo: 'Fora do cartão' }]
    : doCartao
}

/** Ativas em ordem alfabética, arquivadas no fim e marcadas (RF-CAT-02). */
export function opcoesDeCategoria(
  ocorrencias: readonly OcorrenciaDoMes[],
  categorias: readonly Categoria[],
  selecionada: string
): OpcaoDeFiltro[] {
  const ids = new Set(ocorrencias.map((o) => o.categoriaId))
  if (selecionada !== '') ids.add(Number(selecionada))

  const conhecidas = new Set(categorias.map((c) => c.id))
  return [
    ...ordenarParaFiltro(categorias.filter((c) => ids.has(c.id))).map((c) => ({
      valor: String(c.id),
      rotulo: rotuloDeCategoria(c)
    })),
    ...[...ids]
      .filter((id) => !conhecidas.has(id))
      .map((id) => ({ valor: String(id), rotulo: `#${id}` }))
  ]
}

/** Tags do mês em ordem alfabética, sem repetir. */
export function opcoesDeTag(
  ocorrencias: readonly OcorrenciaDoMes[],
  selecionada: string
): string[] {
  const tags = new Set<string>()
  for (const o of ocorrencias) for (const t of o.tags) tags.add(t)
  if (selecionada !== '') tags.add(selecionada)
  return [...tags].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
