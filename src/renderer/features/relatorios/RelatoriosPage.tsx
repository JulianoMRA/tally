import { useState } from 'react'
import { PageHead } from '../../components/layout/PageHead'
import { Field, Input } from '../../components/ui'
import { mesAtualReferencia } from '../../lib/mes-atual'
import PaineisRelatorios from './PaineisRelatorios'
import styles from './relatorios.module.css'

export default function RelatoriosPage() {
  const [mes, setMes] = useState(mesAtualReferencia)

  return (
    <div>
      <PageHead title="Relatórios" subtitle="Comparativos temporais e quebra por categoria." />

      <div className={styles.body}>
        <div className={styles.toolbar}>
          <Field label="Mês">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </Field>
        </div>

        <PaineisRelatorios mes={mes} />
      </div>
    </div>
  )
}
