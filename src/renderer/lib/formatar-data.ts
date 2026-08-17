const MESES_EXTENSO = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
]

const DATA_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/
const MES_REFERENCIA_REGEX = /^(\d{4})-(\d{2})(?:-\d{2})?$/

/**
 * Converte 'YYYY-MM-DD' em 'DD/MM/AAAA' (ex.: '2026-06-12' -> '12/06/2026').
 * Valores ausentes viram '—'; formatos inesperados passam intactos.
 * Split de string proposital: new Date('YYYY-MM-DD') interpreta UTC e em
 * fusos negativos exibiria o dia anterior.
 */
export function formatarDataIso(iso: string | null | undefined): string {
  if (!iso) return '—'
  const match = DATA_ISO_REGEX.exec(iso)
  if (!match) return iso
  const [, ano, mes, dia] = match
  return `${dia}/${mes}/${ano}`
}

/**
 * Converte 'YYYY-MM-DD' em 'DD/MM' (ex.: '2026-06-12' -> '12/06'), formato curto
 * para resumos onde o ano é redundante. Mesma política de valores ausentes/inválidos.
 */
export function formatarDiaMes(iso: string | null | undefined): string {
  if (!iso) return '—'
  const match = DATA_ISO_REGEX.exec(iso)
  if (!match) return iso
  const [, , mes, dia] = match
  return `${dia}/${mes}`
}

/**
 * Converte 'YYYY-MM-DD' em 'DD mmm' (ex.: '2026-08-20' -> '20 ago'), formato de
 * coluna estreita da agenda, onde o mês precisa aparecer — a lista atravessa a
 * virada do mês — mas '20/09' ao lado de '03/10' se lê pior que '20 set' e
 * '03 out'. Mesma política de valores ausentes/inválidos.
 */
export function formatarDiaMesAbreviado(iso: string | null | undefined): string {
  if (!iso) return '—'
  const match = DATA_ISO_REGEX.exec(iso)
  if (!match) return iso
  const [, , mes, dia] = match
  const nomeMes = MESES_EXTENSO[Number(mes) - 1]
  if (!nomeMes) return iso
  return `${dia} ${nomeMes.slice(0, 3)}`
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/**
 * Converte 'YYYY-MM-DD' em 'Qui · 14 de agosto', cabeçalho dos grupos de dia da
 * lista de Saídas. O dia da semana entra porque é o que ancora a memória de um
 * gasto ("o que saiu naquele sábado"), e a data numérica sozinha não dá isso.
 *
 * `Date.UTC` + `getUTCDay` para a aritmética de calendário: `new Date(iso)`
 * parseia como UTC e, em fuso negativo, exibiria o dia anterior.
 */
export function formatarDiaPorExtenso(iso: string | null | undefined): string {
  if (!iso) return '—'
  const match = DATA_ISO_REGEX.exec(iso)
  if (!match) return iso
  const [, ano, mes, dia] = match
  const nomeMes = MESES_EXTENSO[Number(mes) - 1]
  if (!nomeMes) return iso
  const diaSemana =
    DIAS_SEMANA[new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia))).getUTCDay()]
  const rotuloDia = diaSemana ? `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} · ` : ''
  return `${rotuloDia}${Number(dia)} de ${nomeMes}`
}

/**
 * Converte 'YYYY-MM' (ou 'YYYY-MM-DD', ignorando o dia) em mês por extenso
 * (ex.: '2026-06' -> 'junho de 2026'). Valores ausentes viram '—'; formatos
 * inesperados passam intactos.
 */
export function formatarMesReferencia(
  mesReferencia: string | null | undefined,
  opts?: { capitalizar?: boolean }
): string {
  if (!mesReferencia) return '—'
  const match = MES_REFERENCIA_REGEX.exec(mesReferencia)
  if (!match) return mesReferencia
  const [, ano, mes] = match
  const nomeMes = MESES_EXTENSO[Number(mes) - 1]
  if (!nomeMes) return mesReferencia
  const rotulo = `${nomeMes} de ${ano}`
  return opts?.capitalizar ? rotulo.charAt(0).toUpperCase() + rotulo.slice(1) : rotulo
}
