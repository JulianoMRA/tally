import { useNavigate } from 'react-router-dom'
import { quitadaPorParciais } from '@domain/services/pagamento-parcial'
import type { FaturaResumida } from '@shared/ipc/visao-mensal'
import { hojeIsoLocal } from '@shared/datas-locais'
import { Badge, EmptyState, Panel } from '../../components/ui'
import { formatBRL } from '../../lib/format-brl'
import { formatarDiaMes } from '../../lib/formatar-data'
import { pluralizar } from '../../lib/pluralizar'
import { avisoDePrazo } from '../faturas/aviso-fechamento'
import { buildFaturasSearch } from '../faturas/faturas-search'
import { statusVariant } from '../faturas/status-variant'
import styles from './visao-mensal.module.css'

type Props = {
  faturas: FaturaResumida[]
}

export function FaturasCardCompacto({ faturas }: Props) {
  const navigate = useNavigate()

  return (
    <Panel
      title="Faturas"
      meta={`${faturas.length} ${pluralizar('cartão', faturas.length, 'ões')}`}
      flush
    >
      {faturas.length === 0 ? (
        <EmptyState title="Nenhuma fatura neste mês." />
      ) : (
        <ul className={styles.faturaCompactaList}>
          {faturas.map((f) => {
            const hoje = hojeIsoLocal()
            // O mesmo aviso do trilho de Faturas, com o mesmo tom — e o mesmo
            // silêncio para a fatura que os pagamentos parciais já cobriram.
            const aviso = avisoDePrazo(f.fatura, hoje, quitadaPorParciais(f))
            return (
              <li key={f.fatura.id} className={styles.faturaCompactaItem}>
                <span className={styles.cardChip} style={{ background: f.cartaoCor }} />
                <button
                  type="button"
                  className={styles.faturaCompactaNome}
                  onClick={() =>
                    navigate(`/faturas?${buildFaturasSearch(f.fatura.cartaoId, f.fatura.id)}`)
                  }
                  title="Abrir fatura"
                >
                  {f.cartaoNome}
                </button>
                <span className={styles.faturaCompactaVence}>
                  vence {formatarDiaMes(f.fatura.dataVencimento)}
                  {aviso && (
                    <span className={styles.avisoPrazo} data-tom={aviso.tom}>
                      {aviso.texto}
                    </span>
                  )}
                </span>
                {/* Quanto a fatura pesa no mês (RN-10): o que falta pagar dela.
                    As linhas somam a fatia "Faturas" do hero. Com pagamento
                    parcial o total vem embaixo, como contexto. */}
                <span className={`${styles.faturaCompactaTotal} tnum`}>
                  {formatBRL(f.restanteCentavos)}
                  {f.pagoParcialCentavos > 0 && (
                    <span className={styles.faturaCompactaDe}>de {formatBRL(f.totalCentavos)}</span>
                  )}
                </span>
                <Badge variant={statusVariant(f.fatura.status.kind)} />
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
