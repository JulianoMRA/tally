/**
 * Serialização CSV simétrica ao parse-csv.ts: delimitador ';', campos com
 * delimitador/aspas/quebra de linha são citados e aspas internas viram "".
 * Campos que a planilha executaria como fórmula são neutralizados antes da
 * citação — ver `neutralizarFormula`.
 */
export function serializarCsv(header: readonly string[], linhas: readonly string[][]): string {
  const todas = [header, ...linhas]
  return (
    todas
      .map((linha) => linha.map((c) => citarSePreciso(neutralizarFormula(c))).join(';'))
      .join('\n') + '\n'
  )
}

// Excel, LibreOffice e Sheets avaliam como fórmula toda célula que começa com
// um destes. Tab e CR entram porque alguns leitores os descartam e passam a
// enxergar o caractere seguinte como o início da célula.
const INICIO_EXECUTAVEL = /^[=+\-@\t\r]/

// O que o próprio app emite em `formatarValorCsv`. Precisa da exceção: '-123,45'
// é valor, não subtração, e prefixar a coluna de valor faria o Excel lê-la como
// texto — a soma da planilha daria zero.
const NUMERO_SIMPLES = /^-?\d+([.,]\d+)?$/

/**
 * Prefixa com apóstrofo o campo que a planilha avaliaria como fórmula.
 *
 * O vetor é concreto e não exige que o usuário digite contra si mesmo: a
 * importação de CSV aceita arquivo de terceiro, a descrição vai para o banco
 * como texto, e a exportação do mês devolve o mesmo texto para o Excel — onde
 * `=cmd|'/c calc'!A1` deixa de ser uma string.
 *
 * O apóstrofo é a mitigação padrão (OWASP): o Excel o consome como "trate como
 * texto" e não o exibe na célula. Ele fica no arquivo bruto, então o
 * round-trip com o `parseCsv` deixa de ser simétrico para esses valores — só
 * para eles, e nenhum fluxo do app reimporta uma exportação de mês (o import
 * usa `LinhaImportacao`, com outro conjunto de colunas).
 */
function neutralizarFormula(campo: string): string {
  if (!INICIO_EXECUTAVEL.test(campo) || NUMERO_SIMPLES.test(campo)) return campo
  return `'${campo}`
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
