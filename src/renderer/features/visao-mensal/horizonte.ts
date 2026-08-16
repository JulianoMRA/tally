const MES_REFERENCIA_REGEX = /^(\d{4})-(\d{2})$/
const DATA_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function ultimoDiaDoMes(ano: number, mes: number): number {
  // Date.UTC com dia 0 devolve o último dia do mês anterior; passando mes+1
  // chega-se ao último dia de `mes`. UTC porque só interessa a aritmética de
  // calendário, não o instante.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Quantos dias faltam de `hoje` até o fim do mês de referência exibido.
 *
 * Rotula o horizonte da agenda (RF-VIS-07). Meses passados devolvem 0 — não há
 * nada por vir; meses futuros devolvem o mês inteiro, porque a agenda daquele
 * mês começa no dia 1. Formato inesperado também devolve 0, para o rótulo
 * degradar em vez de exibir NaN.
 */
export function diasAteFimDoMes(mesReferencia: string, hoje: string): number {
  const mesMatch = MES_REFERENCIA_REGEX.exec(mesReferencia)
  const hojeMatch = DATA_ISO_REGEX.exec(hoje)
  if (!mesMatch || !hojeMatch) return 0

  const [, anoStr, mesStr] = mesMatch
  const ano = Number(anoStr)
  const mes = Number(mesStr)
  if (mes < 1 || mes > 12) return 0

  const diasNoMes = ultimoDiaDoMes(ano, mes)
  const ultimoDia = `${anoStr}-${mesStr}-${String(diasNoMes).padStart(2, '0')}`
  const primeiroDia = `${anoStr}-${mesStr}-01`

  if (hoje > ultimoDia) return 0
  if (hoje < primeiroDia) return diasNoMes

  const [, , , diaHojeStr] = hojeMatch
  return diasNoMes - Number(diaHojeStr)
}
