export function formatBRL(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatBRLCompacto(centavos: number): string {
  const reais = centavos / 100
  if (Math.abs(reais) >= 1000) {
    return `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`
  }
  return reais.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
