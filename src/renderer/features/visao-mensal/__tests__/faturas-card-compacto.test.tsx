// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { FaturaResumida } from '@shared/ipc/visao-mensal'
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
    renderCard([faturaResumida({ id: 9, cartaoId: 3, cartaoNome: 'Nubank', totalCentavos: 12345 })])

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
})
