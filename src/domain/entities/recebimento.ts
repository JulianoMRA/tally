export type StatusRecebimento = 'Esperado' | 'Recebido'

export type Recebimento = {
  id: number
  /** Fonte recorrente de origem. Null quando a entrada e avulsa. */
  rendaId: number | null
  /**
   * Nome proprio da entrada avulsa. Null quando `rendaId` esta preenchido —
   * ai o nome vem da fonte. O schema garante que exatamente um dos dois
   * existe (CHECK da migration 0011).
   */
  descricao: string | null
  valorCentavos: number
  dataEsperada: string
  dataRecebida: string | null
  status: StatusRecebimento
  createdAt: string
  updatedAt: string
}
