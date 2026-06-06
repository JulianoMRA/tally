import { z } from 'zod'

const DATA_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Valida uma data ISO `YYYY-MM-DD` rejeitando datas de calendário impossíveis.
 *
 * O `new Date('2026-02-30')` do JS não retorna `NaN` — ele "rola" para
 * 02/03/2026 —, então um simples `!isNaN(...)` deixava passar 30/02, 31/04 etc.
 * Aqui reconstruímos a data via `Date.UTC` e conferimos se os componentes
 * sobreviveram ao round-trip; qualquer overflow (dia/mês fora do calendário)
 * altera algum componente e reprova a validação.
 */
export const dataIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD')
  .refine((d) => {
    const match = DATA_REGEX.exec(d)
    if (!match) return false
    const ano = Number(match[1])
    const mes = Number(match[2])
    const dia = Number(match[3])
    const data = new Date(Date.UTC(ano, mes - 1, dia))
    return (
      data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
    )
  }, 'Data inválida')
