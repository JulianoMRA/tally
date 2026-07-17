/**
 * Serialização CSV simétrica ao parse-csv.ts: delimitador ';', campos com
 * delimitador/aspas/quebra de linha são citados e aspas internas viram "".
 */
export function serializarCsv(header: readonly string[], linhas: readonly string[][]): string {
  const todas = [header, ...linhas]
  return todas.map((linha) => linha.map(citarSePreciso).join(';')).join('\n') + '\n'
}

function citarSePreciso(campo: string): string {
  if (/[;"\n\r]/.test(campo)) {
    return `"${campo.replaceAll('"', '""')}"`
  }
  return campo
}

/** Centavos → '1234,56' (sem separador de milhar; inverso de parseValorBrl). */
export function formatarValorCsv(centavos: number): string {
  const inteiros = Math.floor(centavos / 100)
  const resto = Math.abs(centavos % 100)
  return `${inteiros},${resto.toString().padStart(2, '0')}`
}
