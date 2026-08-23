// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Field } from '../Field'
import { SeletorMes } from '../SeletorMes'

describe('SeletorMes', () => {
  afterEach(cleanup)

  it('mostra o mês atual no campo, nomeado pelo label', () => {
    render(<SeletorMes valor="2026-09" onChange={vi.fn()} label="Mês" />)

    const campo = screen.getByLabelText('Mês') as HTMLInputElement
    expect(campo.type).toBe('month')
    expect(campo.value).toBe('2026-09')
  })

  it('anda para o mês anterior no clique da seta esquerda', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SeletorMes valor="2026-09" onChange={onChange} label="Mês" />)

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

    expect(onChange).toHaveBeenCalledWith('2026-08')
  })

  it('anda para o próximo mês no clique da seta direita', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SeletorMes valor="2026-09" onChange={onChange} label="Mês" />)

    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))

    expect(onChange).toHaveBeenCalledWith('2026-10')
  })

  it('vira o ano nas pontas: janeiro volta para dezembro e dezembro avança para janeiro', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<SeletorMes valor="2026-01" onChange={onChange} label="Mês" />)

    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(onChange).toHaveBeenLastCalledWith('2025-12')

    rerender(<SeletorMes valor="2026-12" onChange={onChange} label="Mês" />)
    await user.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(onChange).toHaveBeenLastCalledWith('2027-01')
  })

  it('avisa a escolha feita direto no campo', () => {
    const onChange = vi.fn()
    render(<SeletorMes valor="2026-09" onChange={onChange} label="Mês" />)

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '2026-03' } })

    expect(onChange).toHaveBeenCalledWith('2026-03')
  })

  // Limpar o campo devolvia '' e a tela consultava um mês inexistente. Quem
  // navega pelas setas nunca chega nesse estado; quem apaga o campo, sim.
  it('ignora o campo esvaziado em vez de propagar mês vazio', () => {
    const onChange = vi.fn()
    render(<SeletorMes valor="2026-09" onChange={onChange} label="Mês" />)

    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '' } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it('aceita o id do Field para o rótulo visível apontar para o campo', () => {
    render(
      <Field label="Mês">
        <SeletorMes valor="2026-09" onChange={vi.fn()} />
      </Field>
    )

    expect((screen.getByLabelText('Mês') as HTMLInputElement).value).toBe('2026-09')
  })
})
