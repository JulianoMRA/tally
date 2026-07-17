const VALOR_BRL_REGEX = /^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/

/**
 * Converte valor monetario em formato pt-BR para centavos inteiros.
 * Aceita: '12,34' → 1234; '1.234,56' → 123456; '1234' → 123400.
 * Rejeita negativo, ponto decimal (formato en-US), simbolo de moeda e
 * mais de duas casas decimais.
 */
export function parseValorBrl(texto: string): number {
  const match = VALOR_BRL_REGEX.exec(texto.trim())
  if (!match) {
    throw new Error(`Valor monetário inválido: '${texto}'. Use o formato 1.234,56.`)
  }
  const inteiros = Number(match[1].replaceAll('.', ''))
  const centavos = Number((match[2] ?? '').padEnd(2, '0'))
  return inteiros * 100 + centavos
}
