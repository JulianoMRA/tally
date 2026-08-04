// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RowActions, type AcaoLinha } from '../RowActions'

function acoes(overrides: Partial<AcaoLinha>[] = []): AcaoLinha[] {
  const base: AcaoLinha[] = [
    { label: 'Editar', onClick: vi.fn() },
    { label: 'Duplicar', onClick: vi.fn() },
    { label: 'Excluir', onClick: vi.fn(), destrutiva: true }
  ]
  return base.map((a, i) => ({ ...a, ...overrides[i] }))
}

describe('RowActions', () => {
  afterEach(cleanup)

  it('mostra só a primeira ação como botão e esconde o resto no menu', () => {
    render(<RowActions acoes={acoes()} />)

    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Duplicar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()
  })

  it('respeita quantas ações ficam visíveis', () => {
    render(<RowActions acoes={acoes()} visiveis={2} />)

    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Duplicar' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()
  })

  it('abre o menu e move o foco para o primeiro item', async () => {
    const user = userEvent.setup()
    render(<RowActions acoes={acoes()} />)

    await user.click(screen.getByRole('button', { name: 'Mais ações' }))

    const item = screen.getByRole('menuitem', { name: 'Duplicar' })
    expect(item).toBeTruthy()
    expect(document.activeElement).toBe(item)
  })

  it('dispara a ação escolhida e fecha o menu', async () => {
    const user = userEvent.setup()
    const lista = acoes()
    render(<RowActions acoes={lista} />)

    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    await user.click(screen.getByRole('menuitem', { name: 'Excluir' }))

    expect(lista[2].onClick).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('fecha com Esc e devolve o foco para o gatilho', async () => {
    const user = userEvent.setup()
    render(<RowActions acoes={acoes()} />)

    const gatilho = screen.getByRole('button', { name: 'Mais ações' })
    await user.click(gatilho)
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(gatilho)
  })

  it('navega entre os itens com as setas, pulando os desabilitados', async () => {
    const user = userEvent.setup()
    render(<RowActions acoes={acoes([{}, { disabled: true }, {}])} />)

    await user.click(screen.getByRole('button', { name: 'Mais ações' }))
    // Duplicar está desabilitado, então o foco inicial já é Excluir.
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Excluir' }))

    await user.keyboard('{ArrowDown}')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Excluir' }))
  })

  it('põe o contexto da linha no menu, não no gatilho', async () => {
    const user = userEvent.setup()
    render(<RowActions acoes={acoes()} contexto="Netflix" />)

    // O gatilho fica com rótulo curto: `aria-label` de descendente entra no
    // nome acessível da célula, e a descrição da linha ali dentro fazia a
    // célula de ações colidir com a da descrição.
    const gatilho = screen.getByRole('button', { name: 'Mais ações' })
    await user.click(gatilho)

    expect(screen.getByRole('menu', { name: 'Ações de Netflix' })).toBeTruthy()
  })

  it('não renderiza gatilho quando todas as ações cabem na linha', () => {
    render(<RowActions acoes={[{ label: 'Editar', onClick: vi.fn() }]} visiveis={1} />)

    expect(screen.queryByRole('button', { name: 'Mais ações' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy()
  })

  it('nunca promove ação destrutiva a botão da linha, nem sendo a única', () => {
    render(<RowActions acoes={[{ label: 'Excluir', onClick: vi.fn(), destrutiva: true }]} />)

    // Só o gatilho: Excluir fica no menu. É o caso da parcela já paga, cuja
    // única ação é excluir a despesa.
    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Mais ações' })).toBeTruthy()
  })

  it('mantém a ordem original das ações dentro do menu', async () => {
    const user = userEvent.setup()
    render(<RowActions acoes={acoes()} />)

    await user.click(screen.getByRole('button', { name: 'Mais ações' }))

    const rotulos = screen.getAllByRole('menuitem').map((i) => i.textContent)
    expect(rotulos).toEqual(['Duplicar', 'Excluir'])
  })
})
