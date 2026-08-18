import type { Cartao } from '@domain/entities/cartao'
import { Badge, EmptyState, RowActions } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { pluralizar } from '../../lib/pluralizar'
import { alturasDaSparkline, type ResumoCartao } from './resumir-cartao'
import styles from './cartoes.module.css'

type Props = {
  cartoes: Cartao[]
  resumos: Map<number, ResumoCartao>
  onEditar: (cartao: Cartao) => void
  onArquivar: (cartao: Cartao) => void
  onDesarquivar: (id: number) => void
}

/**
 * A linha do cartão passou a dizer algo (ponto 13).
 *
 * Antes trazia nome, dias e um badge "Ativo" que nunca é falso na visão padrão
 * — cadastro morto. Agora carrega a fatura aberta, seis meses de uso em
 * sparkline e a frequência, o que faz a tela virar leitura e não só cadastro.
 *
 * Arquivados descem para o fim, esmaecidos, em vez de dependerem de um estado
 * separado: o contexto fica visível sem trocar de tela.
 */
export function CartaoList({ cartoes, resumos, onEditar, onArquivar, onDesarquivar }: Props) {
  if (cartoes.length === 0) {
    return (
      <EmptyState
        title="Nenhum cartão encontrado."
        description="Cadastre um cartão para que as faturas comecem a ser geradas."
      />
    )
  }

  const ativos = cartoes.filter((c) => c.ativo)
  const arquivados = cartoes.filter((c) => !c.ativo)

  return (
    <ul className={styles.list}>
      {[...ativos, ...arquivados].map((cartao) => {
        const resumo = resumos.get(cartao.id)
        return (
          <li
            key={cartao.id}
            className={`${styles.listItem} ${cartao.ativo ? '' : styles.listItemArquivado}`}
          >
            <span className={styles.colorChip} style={{ background: cartao.cor }} />

            <div className={styles.listItemInfo}>
              <span className={styles.listItemNome}>{cartao.nome}</span>
              <span className={styles.listItemMeta}>
                fecha dia {cartao.diaFechamento} · vence dia {cartao.diaVencimento}
              </span>
            </div>

            {cartao.ativo ? (
              <>
                <div className={styles.colunaFatura}>
                  <span className={styles.colunaLabel}>Fatura aberta</span>
                  <span className={`${styles.colunaValor} tnum`}>
                    {resumo?.aberturaCentavos !== null && resumo !== undefined
                      ? formatBRL(resumo.aberturaCentavos)
                      : '—'}
                  </span>
                </div>

                <div className={styles.colunaUso}>
                  <Sparkline resumo={resumo} cor={cartao.cor} />
                  <span className={styles.usoNota}>{rotuloUso(resumo)}</span>
                </div>
              </>
            ) : (
              <span className={styles.arquivadoNota}>arquivado</span>
            )}

            <div className={styles.listItemActions}>
              {!cartao.ativo && <Badge variant="archived" />}
              <RowActions
                acoes={
                  cartao.ativo
                    ? [
                        { label: 'Editar', onClick: () => onEditar(cartao) },
                        // Arquivar tem consequência: nunca vira botão solto na
                        // linha, e o RowActions garante isso (ponto 14).
                        {
                          label: 'Arquivar',
                          onClick: () => onArquivar(cartao),
                          destrutiva: true
                        }
                      ]
                    : [{ label: 'Desarquivar', onClick: () => onDesarquivar(cartao.id) }]
                }
                contexto={cartao.nome}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * A sparkline já mostra QUANTOS meses são; repetir "últimos N meses" no texto
 * só estourava a coluna e truncava justamente o número da média, que é a
 * informação. Sobra a média — ou o motivo de não haver uma.
 */
function rotuloUso(resumo: ResumoCartao | undefined): string {
  if (!resumo || resumo.serie.length === 0) return 'sem histórico'
  if (resumo.mesesComUso === 0) return `sem uso há ${resumo.serie.length} meses`
  return resumo.mediaCentavos === null
    ? `${resumo.mesesComUso} ${pluralizar('mês', resumo.mesesComUso, 'eses')} com uso`
    : `média ${formatBRL(resumo.mediaCentavos)}`
}

function Sparkline({ resumo, cor }: { resumo: ResumoCartao | undefined; cor: string }) {
  if (!resumo || resumo.serie.length === 0) return null
  const alturas = alturasDaSparkline(resumo.serie)

  return (
    <span className={styles.sparkline} aria-hidden="true">
      {alturas.map((altura, i) => (
        <span
          key={resumo.serie[i]?.mes ?? i}
          className={styles.sparkBarra}
          // O último mês recebe a cor do cartão; os anteriores ficam neutros,
          // para o olho achar o mais recente sem contar as barras.
          style={{
            height: `${Math.max(altura, 4)}%`,
            background: i === alturas.length - 1 ? cor : 'var(--rule-strong)'
          }}
        />
      ))}
    </span>
  )
}
