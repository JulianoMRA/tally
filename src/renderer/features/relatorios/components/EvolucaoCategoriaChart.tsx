import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { PontoEvolucaoCategoria } from '@shared/ipc/relatorio'
import { formatBRL, formatBRLCompacto } from '../../../lib/format-brl'
import { formatarMesCurto } from '../../../lib/formatar-mes'

type Props = { dados: PontoEvolucaoCategoria[]; cor: string; nome: string }

export function EvolucaoCategoriaChart({ dados, cor, nome }: Props) {
  const dadosFormatados = dados.map((d) => ({
    mes: formatarMesCurto(d.mes),
    [nome]: d.totalCentavos / 100
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
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
        <Line type="monotone" dataKey={nome} stroke={cor} strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  )
}
