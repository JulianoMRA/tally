import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { TotalPorCategoria } from '@shared/ipc/relatorio'
import { formatBRL } from '../../../lib/format-brl'

type Props = { dados: TotalPorCategoria[] }

export function CategoriaPieChart({ dados }: Props) {
  const dadosFormatados = dados.map((d) => ({
    name: d.categoriaNome,
    value: d.totalCentavos,
    cor: d.cor
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={dadosFormatados}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          stroke="var(--bg-elev)"
          strokeWidth={2}
        >
          {dadosFormatados.map((d, i) => (
            <Cell key={i} fill={d.cor} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatBRL(Number(v))}
          contentStyle={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--rule)',
            borderRadius: 8
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
