// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SegmentedControl } from '../SegmentedControl'

const OPCOES = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'parcelada', rotulo: 'Parceladas' },
  { valor: 'assinatura', rotulo: 'Assinaturas' }
] as const

describe('SegmentedControl', () => {
  afterEach(cleanup)

  it('expõe o grupo como radiogroup nomeado e marca a opção escolhida', () => {
    render(<SegmentedControl opcoes={OPCOES} valor="parcelada" onChange={vi.fn()} label="Filtro" />)

    expect(screen.getByRole('radiogroup', { name: 'Filtro' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Parceladas' }).getAttribute('aria-checked')).toBe(
      'true'
    )
    expect(screen.getByRole('radio', { name: 'Todas' }).getAttribute('aria-checked')).toBe('false')
  })

  it('vira tablist quando troca o conteúdo da tela', () => {
    render(
      <SegmentedControl
        opcoes={OPCOES}
        valor="todas"
        onChange={vi.fn()}
        label="Abas"
        semantica="abas"
      />
    )

    expect(screen.getByRole('tablist', { name: 'Abas' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Todas' }).getAttribute('aria-selected')).toBe('true')
  })

  it('avisa a escolha no clique', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl opcoes={OPCOES} valor="todas" onChange={onChange} label="Filtro" />)

    await user.click(screen.getByRole('radio', { name: 'Assinaturas' }))

    expect(onChange).toHaveBeenCalledWith('assinatura')
  })

  it('usa roving tabindex: só a opção ativa é parada de Tab', () => {
    render(<SegmentedControl opcoes={OPCOES} valor="parcelada" onChange={vi.fn()} label="Filtro" />)

    expect(screen.getByRole('radio', { name: 'Parceladas' }).tabIndex).toBe(0)
    expect(screen.getByRole('radio', { name: 'Todas' }).tabIndex).toBe(-1)
    expect(screen.getByRole('radio', { name: 'Assinaturas' }).tabIndex).toBe(-1)
  })

  it('navega com as setas e circula nas pontas', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentedControl opcoes={OPCOES} valor="todas" onChange={onChange} label="Filtro" />)

    screen.getByRole('radio', { name: 'Todas' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('parcelada')

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('assinatura')

    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('assinatura')
  })
})
