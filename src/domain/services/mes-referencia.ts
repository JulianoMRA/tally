/**
 * Avança um mês de referência no formato "YYYY-MM".
 * Ex.: "2026-11" → "2026-12"; "2026-12" → "2027-01".
 */
export function proxMesReferencia(atual: string): string {
  const [anoStr, mesStr] = atual.split('-')
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  if (mes === 12) return `${ano + 1}-01`
  return `${ano}-${String(mes + 1).padStart(2, '0')}`
}

export function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) {
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    return bissexto ? 29 : 28
  }
  if ([4, 6, 9, 11].includes(mes)) return 30
  return 31
}

/**
 * Retorna a data no formato YYYY-MM-DD com o dia clamped ao último dia do mês.
 * Ex.: clampDiaNoMes(2026, 2, 31) → "2026-02-28".
 */
export function clampDiaNoMes(ano: number, mes: number, dia: number): string {
  const diaClamp = Math.min(dia, diasNoMes(ano, mes))
  return `${ano.toString().padStart(4, '0')}-${mes.toString().padStart(2, '0')}-${diaClamp
    .toString()
    .padStart(2, '0')}`
}
