/**
 * Mes de referencia (YYYY-MM) do mes calendario corrente no fuso local.
 * Usado para inicializar pickers de mes em VisaoMensal, Gastos, Rendas,
 * Relatorios. Antes existia uma copia local em 5+ arquivos.
 */
export function mesAtualReferencia(): string {
  const hoje = new Date()
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
}
