const MESES_CURTOS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez'
]

/**
 * Converte 'YYYY-MM' em 'mes/aa' curto (ex.: '2026-06' -> 'jun/26').
 * Usado em eixos de gráficos onde espaço é limitado.
 */
export function formatarMesCurto(mesReferencia: string): string {
  const [ano, mes] = mesReferencia.split('-').map(Number)
  return `${MESES_CURTOS[mes - 1]}/${String(ano).slice(-2)}`
}
