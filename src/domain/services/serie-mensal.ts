import { mesReferenciaAnterior } from './mes-referencia'

/**
 * Gera uma série crescente de N meses de referência (formato YYYY-MM)
 * terminando em `mesFinal`. Útil para iterar comparativos de 6/12 meses.
 *
 * Ex.: gerarSerieMensal('2026-06', 3) === ['2026-04', '2026-05', '2026-06']
 */
export function gerarSerieMensal(mesFinal: string, quantidade: number): string[] {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error(`quantidade deve ser inteiro >= 1, recebido: ${quantidade}`)
  }

  const meses: string[] = [mesFinal]
  for (let i = 1; i < quantidade; i++) {
    meses.unshift(mesReferenciaAnterior(meses[0]))
  }
  return meses
}
