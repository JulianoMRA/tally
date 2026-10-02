// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { FaturaResumida } from '@shared/ipc/visao-mensal'
import { hojeIsoLocal } from '@shared/datas-locais'
import { somarDias } from '@domain/services/mes-referencia'
import { FaturasCardCompacto } from '../FaturasCardCompacto'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname + loc.search}</div>
}

function faturaResumida(
  over: Partial<FaturaResumida> & { id: number; cartaoId: number }
): FaturaResumida {
  const { id, cartaoId, ...rest } = over
  return {
    fatura: {
      id,
      cartaoId,
      mesReferencia: '2026-06',
      dataFechamento: '2026-06-05',
      dataVencimento: '2026-06-12',
      status: { kind: 'Aberta' },
      createdAt: '2026-06-01',
      updatedAt: '2026-06-01'
    },
    cartaoNome: 'Inter',
    cartaoCor: '#ff7a00',
    totalCentavos: 5000,
    pagoParcialCentavos: 0,
    restanteCentavos: 5000,
    ...rest
  }
}

function renderCard(faturas: FaturaResumida[]) {
  return render(
    <MemoryRouter initialEntries={['/mensal']}>
      <FaturasCardCompacto faturas={faturas} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('FaturasCardCompacto', () => {
  afterEach(cleanup)

  it('exibe nome do cartão, vencimento curto e total formatado', () => {
    renderCard([
      faturaResumida({
        id: 9,
        cartaoId: 3,
        cartaoNome: 'Nubank',
        totalCentavos: 12345,
        restanteCentavos: 12345
      })
    ])

    expect(screen.getByRole('button', { name: 'Nubank' })).toBeTruthy()
    expect(screen.getByText('vence 12/06')).toBeTruthy()
    expect(screen.getByText(/R\$\s*123,45/)).toBeTruthy()
  })

  it('mostra estado vazio quando não há faturas', () => {
    renderCard([])
    expect(screen.getByText('Nenhuma fatura neste mês.')).toBeTruthy()
  })

  it('navega para o detalhe da fatura ao clicar no nome do cartão', async () => {
    const user = userEvent.setup()
    renderCard([faturaResumida({ id: 9, cartaoId: 3, cartaoNome: 'Nubank' })])

    await user.click(screen.getByRole('button', { name: 'Nubank' }))

    expect(screen.getByTestId('location').textContent).toBe('/faturas?cartaoId=3&faturaId=9')
  })

  it('exibe "fecha em N dias" para fatura Aberta com fechamento próximo', () => {
    const base = faturaResumida({ id: 9, cartaoId: 3 })
    renderCard([
      {
        ...base,
        fatura: { ...base.fatura, dataFechamento: somarDias(hojeIsoLocal(), 3) }
      }
    ])

    expect(screen.getByText('fecha em 3 dias')).toBeTruthy()
  })

  it('não exibe aviso para fatura Fechada nem para fechamento distante', () => {
    const proxima = faturaResumida({ id: 9, cartaoId: 3 })
    const distante = faturaResumida({ id: 10, cartaoId: 4, cartaoNome: 'Nubank' })
    renderCard([
      {
        ...proxima,
        fatura: {
          ...proxima.fatura,
          dataFechamento: somarDias(hojeIsoLocal(), 3),
          status: { kind: 'Fechada' }
        }
      },
      {
        ...distante,
        fatura: { ...distante.fatura, dataFechamento: somarDias(hojeIsoLocal(), 15) }
      }
    ])

    expect(screen.queryByText(/fecha em|fecha hoje|fecha amanhã/)).toBeNull()
  })

  // RF-FAT-06 — o aviso novo, com o mesmo helper do trilho de Faturas: a fatura
  // Fechada a dois dias do vencimento não dizia nada.
  it('exibe "vence em N dias" para fatura Fechada com vencimento próximo, em tom de atenção', () => {
    const base = faturaResumida({ id: 9, cartaoId: 3 })
    renderCard([
      {
        ...base,
        fatura: {
          ...base.fatura,
          status: { kind: 'Fechada' },
          dataVencimento: somarDias(hojeIsoLocal(), 2)
        }
      }
    ])

    expect(screen.getByText('vence em 2 dias').getAttribute('data-tom')).toBe('atencao')
  })

  it('a fatura vencida avisa em tom de alerta', () => {
    const base = faturaResumida({ id: 9, cartaoId: 3 })
    renderCard([
      {
        ...base,
        fatura: {
          ...base.fatura,
          status: { kind: 'Fechada' },
          dataVencimento: somarDias(hojeIsoLocal(), -3)
        }
      }
    ])

    expect(screen.getByText('vencida há 3 dias').getAttribute('data-tom')).toBe('alerta')
  })
})

/**
 * RN-10 — cada linha mostra quanto a fatura pesa no mês, que é o que falta
 * pagar dela. A soma das linhas volta a bater com a fatia "Faturas" do hero; com
 * o total, o card somaria R$ 800 ao lado de um hero que conta R$ 600.
 */
describe('FaturasCardCompacto — pagamento parcial', () => {
  afterEach(cleanup)

  function comParcial(over: Partial<FaturaResumida> = {}): FaturaResumida {
    return faturaResumida({
      id: 9,
      cartaoId: 3,
      totalCentavos: 80000,
      pagoParcialCentavos: 20000,
      restanteCentavos: 60000,
      ...over
    })
  }

  it('mostra o que falta pagar, com o total como contexto', () => {
    renderCard([comParcial()])

    expect(screen.getByText(/^R\$\s*600,00$/)).toBeTruthy()
    expect(screen.getByText(/^de R\$\s*800,00$/)).toBeTruthy()
  })

  it('sem pagamento parcial, não há contexto: o número é o total', () => {
    renderCard([faturaResumida({ id: 9, cartaoId: 3 })])

    expect(screen.getByText(/^R\$\s*50,00$/)).toBeTruthy()
    expect(screen.queryByText(/^de R\$/)).toBeNull()
  })

  // Fatura Fechada cujos parciais cobrem o total: não há o que pagar, só o que
  // marcar. O aviso de vencimento seria o alarme falso que Faturas não dá mais.
  it('fatura Fechada coberta pelos parciais não avisa vencimento', () => {
    const base = comParcial({ pagoParcialCentavos: 80000, restanteCentavos: 0 })
    renderCard([
      {
        ...base,
        fatura: {
          ...base.fatura,
          status: { kind: 'Fechada' },
          dataVencimento: somarDias(hojeIsoLocal(), 2)
        }
      }
    ])

    expect(screen.queryByText(/vence em/)).toBeNull()
    expect(screen.getByText(/^R\$\s*0,00$/)).toBeTruthy()
  })

  it('fatura Fechada com parcial e ainda algo a pagar segue avisando', () => {
    const base = comParcial()
    renderCard([
      {
        ...base,
        fatura: {
          ...base.fatura,
          status: { kind: 'Fechada' },
          dataVencimento: somarDias(hojeIsoLocal(), 2)
        }
      }
    ])

    expect(screen.getByText('vence em 2 dias')).toBeTruthy()
  })

  it('fatura vencida coberta pelos parciais não diz "vencida"', () => {
    const base = comParcial({ pagoParcialCentavos: 80000, restanteCentavos: 0 })
    renderCard([
      {
        ...base,
        fatura: {
          ...base.fatura,
          status: { kind: 'Fechada' },
          dataVencimento: somarDias(hojeIsoLocal(), -3)
        }
      }
    ])

    expect(screen.queryByText(/vencida há/)).toBeNull()
  })
})
