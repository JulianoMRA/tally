import { useParams } from 'react-router-dom'
import { formatBRL } from '../../lib/format-brl'
import { formatarDataIso, formatarDiaMes, formatarMesReferencia } from '../../lib/formatar-data'
import { useVisaoMensal } from './hooks/use-visao-mensal'
import styles from './print-mensal.module.css'

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Rota #/print/:mes — versão enxuta da visão mensal para o printToPDF do main
 * (janela oculta). O atributo data-print-pronto sinaliza que os dados do IPC
 * chegaram; o main espera por ele antes de gerar o PDF.
 */
export default function PrintMensalPage() {
  const { mes } = useParams<{ mes: string }>()
  const mesValido = mes !== undefined && MES_REGEX.test(mes)
  const { detalhe, erro } = useVisaoMensal(mesValido ? mes : '1900-01')

  if (!mesValido) {
    return <p className={styles.erro}>Mês inválido.</p>
  }
  if (erro) {
    return <p className={styles.erro}>{erro}</p>
  }
  if (!detalhe) {
    return <p className={styles.carregando}>Carregando…</p>
  }

  const { totais } = detalhe

  return (
    <div className={styles.pagina} data-print-pronto>
      <header className={styles.cabecalho}>
        <h1>Tally — {formatarMesReferencia(detalhe.mesReferencia, { capitalizar: true })}</h1>
        <p>Relatório mensal de faturas, gastos e recebimentos.</p>
      </header>

      <section className={styles.totais}>
        <div>
          <span>Entradas recebidas</span>
          <strong>{formatBRL(totais.totalEntradasRecebidasCentavos)}</strong>
        </div>
        <div>
          <span>Saídas</span>
          <strong>{formatBRL(totais.totalSaidasCentavos)}</strong>
        </div>
        <div>
          <span>Saldo só com entradas recebidas</span>
          <strong>{formatBRL(totais.saldoRealizadoCentavos)}</strong>
        </div>
        <div>
          <span>Saldo projetado</span>
          <strong>{formatBRL(totais.saldoProjetadoCentavos)}</strong>
        </div>
      </section>

      <section>
        <h2>Faturas ({detalhe.faturas.length})</h2>
        {detalhe.faturas.length === 0 ? (
          <p className={styles.vazio}>Nenhuma fatura neste mês.</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Cartão</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th className={styles.num}>Total</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.faturas.map((f) => (
                <tr key={f.fatura.id}>
                  <td>{f.cartaoNome}</td>
                  <td>{formatarDiaMes(f.fatura.dataVencimento)}</td>
                  <td>{f.fatura.status.kind}</td>
                  <td className={styles.num}>{formatBRL(f.totalCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Gastos fora de cartão ({detalhe.gastosForaCartao.length})</h2>
        {detalhe.gastosForaCartao.length === 0 ? (
          <p className={styles.vazio}>Nenhum gasto fora de cartão.</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Forma</th>
                <th>Data</th>
                <th className={styles.num}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.gastosForaCartao.map((g) => (
                <tr key={g.id}>
                  <td>{g.descricao}</td>
                  <td>{g.formaPagamento}</td>
                  <td>{formatarDataIso(g.dataCompra)}</td>
                  <td className={styles.num}>{formatBRL(g.valorCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Recebimentos ({detalhe.recebimentos.length})</h2>
        {detalhe.recebimentos.length === 0 ? (
          <p className={styles.vazio}>Nenhum recebimento neste mês.</p>
        ) : (
          <table className={styles.tabela}>
            <thead>
              <tr>
                <th>Fonte</th>
                <th>Data esperada</th>
                <th>Status</th>
                <th className={styles.num}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {detalhe.recebimentos.map((r) => (
                <tr key={r.id}>
                  <td>{r.rendaNome ?? 'Avulso'}</td>
                  <td>{formatarDataIso(r.dataEsperada)}</td>
                  <td>{r.status}</td>
                  <td className={styles.num}>{formatBRL(r.valorCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
