import { useState } from 'react'
import { EmptyState, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { pluralizar } from '../../lib/pluralizar'
import type { FatiaPizza } from './montar-pizza'
import styles from './visao-mensal.module.css'

type Props = {
  fatias: FatiaPizza[]
}

/** Nomes na dica de "Outros" antes de resumir o resto em "e mais N". */
const MAXIMO_NOMES_NA_DICA = 3

const LISTA = new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' })

function listarAgrupadas(nomes: string[]): string {
  if (nomes.length <= MAXIMO_NOMES_NA_DICA) return LISTA.format(nomes)
  const restantes = nomes.length - MAXIMO_NOMES_NA_DICA
  return LISTA.format([...nomes.slice(0, MAXIMO_NOMES_NA_DICA), `mais ${restantes}`])
}

/**
 * Centro da fatia na metade de cima do disco? O ângulo conta a partir das 12h,
 * então o cosseno do ângulo médio é positivo acima do centro.
 */
function fatiaNaMetadeDeCima(fatia: FatiaPizza): boolean {
  const meio = ((fatia.inicioGraus + fatia.fimGraus) / 2) * (Math.PI / 180)
  return Math.cos(meio) > 0
}

function contarCategorias(fatias: FatiaPizza[]): number {
  return fatias.reduce((n, f) => n + (f.tipo === 'outros' ? f.agrupadas.length : 1), 0)
}

/**
 * RF-VIS-08 — a divisão dos gastos do mês em pizza, com o mesmo dado do ranking
 * "Para onde foi". O ranking responde "quanto"; a pizza, "que parte do todo".
 *
 * SVG próprio, sem recharts: a aba Mês não carrega o chunk de gráficos, e o
 * desenho sai pronto de `montarPizza`, onde é testado. Sem animação de entrada
 * — a folha de contato já confundiu animação com defeito.
 *
 * Fatia e linha da legenda compartilham o destaque: passar o mouse em qualquer
 * uma das duas acende a outra. A dica é realce, nunca o único caminho até o
 * número — o valor está no ranking ao lado, o percentual na legenda.
 */
export function PizzaCategorias({ fatias }: Props) {
  const [chaveAtiva, setChaveAtiva] = useState<string | null>(null)
  const ativa = fatias.find((f) => f.chave === chaveAtiva) ?? null
  const qtdCategorias = contarCategorias(fatias)

  const descricao = `Divisão dos gastos por categoria: ${fatias
    .map((f) => `${f.nome} ${f.percentual}%`)
    .join(', ')}`

  const ativar = (chave: string) => () => setChaveAtiva(chave)
  const desativar = () => setChaveAtiva(null)

  return (
    <Panel
      title="Divisão dos gastos"
      meta={qtdCategorias > 0 ? `${qtdCategorias} ${pluralizar('categoria', qtdCategorias)}` : null}
      flush
    >
      {fatias.length === 0 ? (
        <EmptyState title="Nenhum gasto neste mês." />
      ) : (
        <div className={styles.pizzaCorpo}>
          <div className={styles.pizzaGrafico}>
            <svg viewBox="0 0 100 100" role="img" aria-label={descricao}>
              {fatias.map((fatia) => (
                <path
                  key={fatia.chave}
                  d={fatia.caminho}
                  fill={fatia.tipo === 'categoria' ? fatia.cor : undefined}
                  className={`${styles.pizzaFatia} ${
                    fatia.tipo === 'outros' ? styles.pizzaFatiaOutros : ''
                  }`}
                  data-apagada={ativa !== null && ativa.chave !== fatia.chave}
                  onMouseEnter={ativar(fatia.chave)}
                  onMouseLeave={desativar}
                />
              ))}
              {/* Contorno do disco: uma categoria na cor padrão (quase preta)
                  some sobre o card do tema escuro, e na pizza isso vira um
                  buraco. O contorno devolve a forma. */}
              <circle cx={50} cy={50} r={48} className={styles.pizzaContorno} />
            </svg>

            {ativa && (
              <div
                role="tooltip"
                className={styles.pizzaDica}
                data-posicao={fatiaNaMetadeDeCima(ativa) ? 'abaixo' : 'acima'}
              >
                <strong className={`${styles.pizzaDicaValor} tnum`}>
                  {formatBRL(ativa.totalCentavos)}
                </strong>
                <span>{`${ativa.nome} · ${ativa.percentual}%`}</span>
                {ativa.tipo === 'outros' && (
                  <span>{`Inclui ${listarAgrupadas(ativa.agrupadas)}`}</span>
                )}
              </div>
            )}
          </div>

          <ul className={styles.pizzaLegenda} aria-label="Legenda">
            {fatias.map((fatia) => (
              <li
                key={fatia.chave}
                className={styles.pizzaLegendaItem}
                data-ativa={ativa?.chave === fatia.chave}
                onMouseEnter={ativar(fatia.chave)}
                onMouseLeave={desativar}
              >
                <span
                  className={`${styles.pizzaChip} ${
                    fatia.tipo === 'outros' ? styles.pizzaChipOutros : ''
                  }`}
                  style={fatia.tipo === 'categoria' ? { background: fatia.cor } : undefined}
                />
                <span className={styles.pizzaLegendaNome} title={fatia.nome}>
                  {fatia.nome}
                </span>
                <span className={`${styles.pizzaLegendaPct} tnum`}>{fatia.percentual}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
