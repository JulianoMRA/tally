import { z } from 'zod'

/**
 * Leitura e escrita de valor monetário digitado nos formulários.
 *
 * Existia em cinco cópias de `parseCentavos`, três de `centavosParaReais` mais
 * uma inline, e dez do regex de validação — todas idênticas, espalhadas por
 * sete arquivos de tela. Num app de finanças isso significa que mudar a regra
 * de entrada de valor exige dezoito edições coordenadas, e a que passar batido
 * vira divergência silenciosa.
 *
 * **O ponto tem dois papéis, e quem decide é o que vem depois dele.** Seguido
 * de exatamente três dígitos, é separador de milhar (`1.000`); seguido de uma
 * ou duas casas no fim, é decimal (`12.34`, hábito de teclado numérico). Antes
 * desta unificação o formulário só entendia o segundo papel e o import de CSV
 * só o primeiro — dava para importar um valor que o app não deixava digitar.
 *
 * `src/shared/csv/valor-brl.ts` continua com gramática própria e mais estrita,
 * de propósito: lá o valor entra em lote e ninguém vê o resultado antes de
 * gravar. Esta gramática é um **superconjunto** daquela, então tudo que é
 * importável é digitável — a assimetria que sobra aponta para o lado seguro.
 */

/** `1.234.567` — grupos de milhar bem formados. */
const APENAS_MILHAR = /^\d{1,3}(?:\.\d{3})+$/
/** `12.34` — ponto como separador decimal. */
const PONTO_DECIMAL = /^(\d+)\.(\d{1,2})$/
/** `1.234,56` ou `1234,56` — vírgula decimal, milhar opcional no ponto. */
const VIRGULA_DECIMAL = /^(\d{1,3}(?:\.\d{3})*|\d+),(\d{1,2})$/
/** `1234` — só reais. */
const SO_INTEIROS = /^\d+$/

function centavosDe(inteiros: string, decimais: string): number {
  return Number(inteiros.replaceAll('.', '')) * 100 + Number(decimais.padEnd(2, '0'))
}

/**
 * Converte o valor digitado para centavos inteiros, ou lança se não for válido.
 *
 * A conta é inteira, sem passar por float. A versão anterior fazia
 * `parseFloat(x) * 100` — que dá `1998.9999999999998` para `'19,99'` — e só não
 * errava por causa do `Math.round`. Com no máximo duas casas o arredondamento
 * sempre salvava, então nunca houve bug; a conta inteira apenas não depende
 * disso para estar certa.
 */
export function parseCentavos(reais: string): number {
  const virgula = VIRGULA_DECIMAL.exec(reais)
  if (virgula) return centavosDe(virgula[1], virgula[2])

  if (APENAS_MILHAR.test(reais)) return Number(reais.replaceAll('.', '')) * 100

  const ponto = PONTO_DECIMAL.exec(reais)
  if (ponto) return centavosDe(ponto[1], ponto[2])

  if (SO_INTEIROS.test(reais)) return Number(reais) * 100

  throw new Error(`Valor monetário inválido: '${reais}'.`)
}

/** Mesma gramática do `parseCentavos`, sem lançar. Para validar antes de converter. */
export function ehValorValido(reais: string): boolean {
  return (
    VIRGULA_DECIMAL.test(reais) ||
    APENAS_MILHAR.test(reais) ||
    PONTO_DECIMAL.test(reais) ||
    SO_INTEIROS.test(reais)
  )
}

/**
 * Centavos → `'1500,00'`, o texto que os campos de edição abrem preenchidos.
 *
 * Sem separador de milhar: o campo tem de abrir com algo que ele próprio
 * aceite de volta, e sem agrupamento o ida-e-volta é trivialmente verdadeiro.
 */
export function centavosParaReais(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

/** Campo de valor para os formulários com zod + react-hook-form. */
export const valorReaisSchema = z.string().refine(ehValorValido, { message: 'Valor inválido' })
