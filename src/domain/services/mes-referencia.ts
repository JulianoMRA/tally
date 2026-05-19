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
