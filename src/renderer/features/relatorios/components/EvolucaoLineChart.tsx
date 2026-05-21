import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { PontoEvolucaoSaldo } from '@shared/ipc/relatorio'
import { formatBRL, formatBRLCompacto } from '../../../lib/format-brl'
import { formatarMesCurto } from '../../../lib/formatar-mes'

type Props = { dados: PontoEvolucaoSaldo[] }

export function EvolucaoLineChart({ dados }: Props) {
  const dadosFormatados = dados.map((d) => ({
    mes: formatarMesCurto(d.mes),
    Entradas: d.entradasCentavos / 100,
    Saídas: d.saidasCentavos / 100,
    Saldo: d.saldoCentavos / 100
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={dadosFormatados} margin={{ top: 8, right: 24, bottom: 0, left: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--rule)" />
        <XAxis dataKey="mes" stroke="var(--ink-muted)" fontSize={12} />
        <YAxis
          stroke="var(--ink-muted)"
          fontSize={12}
          tickFormatter={(v: number) => formatBRLCompacto(v * 100)}
        />
        <Tooltip
          formatter={(v: number) => formatBRL(v * 100)}
          contentStyle={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--rule)',
            borderRadius: 8
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="Entradas" stroke="var(--income)" strokeWidth={2} dot />
        <Line type="monotone" dataKey="Saídas" stroke="var(--expense)" strokeWidth={2} dot />
        <Line
          type="monotone"
          dataKey="Saldo"
          stroke="var(--ink)"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
