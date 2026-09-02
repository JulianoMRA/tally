import { pluralizar } from '../../lib/pluralizar'

const MES_REFERENCIA_REGEX = /^(\d{4})-(\d{2})$/
const DATA_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/

function ultimoDiaDoMes(ano: number, mes: number): number {
  // Date.UTC com dia 0 devolve o último dia do mês anterior; passando mes+1
  // chega-se ao último dia de `mes`. UTC porque só interessa a aritmética de
  // calendário, não o instante.
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Onde o mês exibido está em relação a hoje.
 *
 * Os três casos precisam de rótulos diferentes e antes colapsavam num número
 * só: `Encerrado` e o último dia de `Corrente` davam ambos zero, e `Futuro`
 * devolvia o mês inteiro — que a agenda contava como "próximos N dias" a partir
 * de hoje, apontando para outro mês.
 */
export type Horizonte =
  | { kind: 'Indefinido' }
  | { kind: 'Encerrado' }
  | { kind: 'Corrente'; diasRestantes: number }
  | { kind: 'Futuro'; diasNoMes: number }

export function classificarHorizonte(mesReferencia: string, hoje: string): Horizonte {
  const mesMatch = MES_REFERENCIA_REGEX.exec(mesReferencia)
  const hojeMatch = DATA_ISO_REGEX.exec(hoje)
  if (!mesMatch || !hojeMatch) return { kind: 'Indefinido' }

  const [, anoStr, mesStr] = mesMatch
  const mes = Number(mesStr)
  if (mes < 1 || mes > 12) return { kind: 'Indefinido' }

  const diasNoMes = ultimoDiaDoMes(Number(anoStr), mes)
  const primeiroDia = `${anoStr}-${mesStr}-01`
  const ultimoDia = `${anoStr}-${mesStr}-${String(diasNoMes).padStart(2, '0')}`

  if (hoje > ultimoDia) return { kind: 'Encerrado' }
  // Mês futuro vale o mês inteiro, não o intervalo desde hoje: a agenda daquele
  // mês começa no dia 1, e contar de hoje faria setembro visto em agosto
  // anunciar 45 dias.
  if (hoje < primeiroDia) return { kind: 'Futuro', diasNoMes }

  const [, , , diaHojeStr] = hojeMatch
  return { kind: 'Corrente', diasRestantes: diasNoMes - Number(diaHojeStr) }
}

/**
 * Rótulo do horizonte da agenda (RF-VIS-07).
 *
 * "Próximos N dias" só é verdade no mês corrente. Em mês futuro o horizonte é
 * aquele mês inteiro, e a palavra "próximos" o ancorava em hoje — em setembro,
 * dezembro anunciava "próximos 31 dias", que a partir de hoje seriam setembro e
 * outubro. Entrada sem sentido devolve string vazia: o `meta` do painel some em
 * vez de afirmar algo falso.
 */
export function rotuloHorizonte(mesReferencia: string, hoje: string): string {
  const horizonte = classificarHorizonte(mesReferencia, hoje)

  switch (horizonte.kind) {
    case 'Indefinido':
      return ''
    case 'Encerrado':
      return 'mês encerrado'
    case 'Futuro':
      return `os ${horizonte.diasNoMes} dias do mês`
    case 'Corrente': {
      const { diasRestantes } = horizonte
      if (diasRestantes === 0) return 'último dia do mês'
      return `próximos ${diasRestantes} ${pluralizar('dia', diasRestantes)}`
    }
  }
}
