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
