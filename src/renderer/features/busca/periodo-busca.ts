/**
 * O intervalo de meses da busca (RF-DES-22).
 *
 * Fica separado da tela porque é aritmética de calendário, que é onde este
 * projeto já se queimou: virada de ano, mês 12 + 1, e o `Date` do JS aceitando
 * mês 13 sem reclamar. Aqui a conta é feita nos números, sem `Date`.
 */
const MES_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/

export type PeriodoBusca = { mesInicio: string; mesFim: string }

function partes(mes: string): { ano: number; mes: number } | null {
  const m = MES_REGEX.exec(mes)
  if (!m) return null
  return { ano: Number(m[1]), mes: Number(m[2]) }
}

function formatar(ano: number, mes: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}`
}

/** Recua `n` meses a partir de `mes`, atravessando a virada de ano. */
export function recuarMeses(mes: string, n: number): string {
  const p = partes(mes)
  if (!p) throw new Error(`Mês inválido: '${mes}'. Esperado YYYY-MM.`)
  // -1 porque o mês é 1..12 e a aritmética modular precisa de 0..11.
  const total = p.ano * 12 + (p.mes - 1) - n
  return formatar(Math.floor(total / 12), (total % 12) + 1)
}

/**
 * O intervalo com que a busca abre: os últimos 12 meses, terminando no mês
 * corrente.
 *
 * Olhar para trás é o padrão porque a pergunta que motiva a busca é sobre o
 * passado ("onde está aquela compra de fevereiro"). Meses futuros existem no
 * banco só até o horizonte já projetado, então oferecê-los por padrão mostraria
 * um recorte que depende de quanto o usuário navegou — e não do que ele gastou.
 */
export function periodoPadrao(mesCorrente: string): PeriodoBusca {
  return { mesInicio: recuarMeses(mesCorrente, 11), mesFim: mesCorrente }
}

export type ProblemaPeriodo = 'mes-invalido' | 'invertido' | 'longo-demais'

/** Espelha o schema do IPC, para a tela recusar antes de chamar o main. */
export function validarPeriodo(p: PeriodoBusca): ProblemaPeriodo | null {
  const a = partes(p.mesInicio)
  const b = partes(p.mesFim)
  if (!a || !b) return 'mes-invalido'
  if (p.mesInicio > p.mesFim) return 'invertido'
  const meses = (b.ano - a.ano) * 12 + (b.mes - a.mes) + 1
  if (meses > 120) return 'longo-demais'
  return null
}

export const MENSAGEM_PROBLEMA: Record<ProblemaPeriodo, string> = {
  'mes-invalido': 'Informe os dois meses no formato AAAA-MM.',
  invertido: 'O mês inicial não pode ser posterior ao final.',
  'longo-demais': 'O intervalo da busca é de no máximo 120 meses.'
}
