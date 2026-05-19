import { diferencaEmMeses, proxMesReferencia } from './mes-referencia'

export type ExtensaoNecessaria = {
  quantidade: number
  ocorrenciaInicial: number
  mesReferenciaInicial: string
}

export type CalcularExtensaoInput = {
  mesAlvo: string
  ultimoMesExistente: string | null
  ultimoNumeroExistente: number | null
}

/**
 * RN-04 — calcula quantos meses adicionais precisam ser gerados para que
 * uma assinatura/renda recorrente alcance `mesAlvo`. Pure, sem I/O.
 *
 * Retorna null quando nada precisa ser gerado:
 * - mesAlvo já coberto (igual ao último existente);
 * - mesAlvo no passado relativo ao último existente (não retroage);
 * - última ocorrência inexistente (defensivo: sinaliza que o caller deveria
 *   ter usado o caminho de criação inicial, não o de extensão).
 */
export function calcularExtensaoNecessaria(
  input: CalcularExtensaoInput
): ExtensaoNecessaria | null {
  const { mesAlvo, ultimoMesExistente, ultimoNumeroExistente } = input

  if (ultimoMesExistente === null) return null
  if (ultimoNumeroExistente === null) {
    throw new Error(
      'ultimoNumeroExistente nao pode ser null quando ultimoMesExistente esta preenchido'
    )
  }

  const delta = diferencaEmMeses(ultimoMesExistente, mesAlvo)
  if (delta <= 0) return null

  return {
    quantidade: delta,
    ocorrenciaInicial: ultimoNumeroExistente + 1,
    mesReferenciaInicial: proxMesReferencia(ultimoMesExistente)
  }
}
