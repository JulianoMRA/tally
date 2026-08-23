// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { Table } from '../Table'

describe('Table', () => {
  afterEach(cleanup)

  it('renderiza uma tabela com o conteúdo recebido', () => {
    render(
      <Table>
        <tbody>
          <tr>
            <td>Notebook</td>
          </tr>
        </tbody>
      </Table>
    )

    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('cell', { name: 'Notebook' })).toBeTruthy()
  })

  // Saídas usa o degrau compacto desde a v1.5.1 — num mês com 15 parceladas
  // isso vale mais de uma tela de rolagem. As outras tabelas ficam no padrão.
  it('aplica a densidade compacta só quando pedida', () => {
    const { rerender } = render(
      <Table>
        <tbody />
      </Table>
    )
    const padrao = screen.getByRole('table').className

    rerender(
      <Table densidade="compacta">
        <tbody />
      </Table>
    )
    const compacta = screen.getByRole('table').className

    expect(compacta).not.toBe(padrao)
    expect(compacta.split(' ').length).toBeGreaterThan(padrao.split(' ').length)
  })

  it('aceita classes da tela sem perder as próprias', () => {
    render(
      <Table className="minhaClasse">
        <tbody />
      </Table>
    )

    const cls = screen.getByRole('table').className
    expect(cls).toContain('minhaClasse')
    expect(cls.trim().split(' ').length).toBeGreaterThan(1)
  })
})
