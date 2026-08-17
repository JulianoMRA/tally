// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidePanel } from '../SidePanel'

afterEach(cleanup)

describe('SidePanel — estrutura', () => {
  it('expõe um diálogo modal nomeado pelo título', () => {
    render(
      <SidePanel titulo="Nova saída" onFechar={() => {}}>
        <p>corpo</p>
      </SidePanel>
    )

    const dialogo = screen.getByRole('dialog', { name: 'Nova saída' })
    expect(dialogo.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('corpo')).toBeTruthy()
  })

  it('liga a descrição ao diálogo via aria-describedby', () => {
    render(
      <SidePanel
        titulo="Nova saída"
        descricao="Registre uma compra ou assinatura"
        onFechar={() => {}}
      >
        <p>corpo</p>
      </SidePanel>
    )

    const dialogo = screen.getByRole('dialog')
    const descricao = screen.getByText('Registre uma compra ou assinatura')
    expect(dialogo.getAttribute('aria-describedby')).toBe(descricao.id)
  })

  // Sem descrição o atributo tem que sumir, não apontar para um id vazio: um
  // aria-describedby órfão faz o leitor de tela anunciar nada e engolir o
  // resto da descrição acessível.
  it('omite aria-describedby quando não há descrição', () => {
    render(
      <SidePanel titulo="Nova saída" onFechar={() => {}}>
        <p>corpo</p>
      </SidePanel>
    )

    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeNull()
  })

  it('renderiza o rodapé quando recebe um', () => {
    render(
      <SidePanel titulo="Nova saída" onFechar={() => {}} rodape={<button>Salvar</button>}>
        <p>corpo</p>
      </SidePanel>
    )

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  })

  it('dois painéis simultâneos não colidem de id', () => {
    render(
      <>
        <SidePanel titulo="Primeiro" descricao="d1" onFechar={() => {}}>
          <p>a</p>
        </SidePanel>
        <SidePanel titulo="Segundo" descricao="d2" onFechar={() => {}}>
          <p>b</p>
        </SidePanel>
      </>
    )

    const [um, dois] = screen.getAllByRole('dialog')
    expect(um?.getAttribute('aria-labelledby')).not.toBe(dois?.getAttribute('aria-labelledby'))
    expect(um?.getAttribute('aria-describedby')).not.toBe(dois?.getAttribute('aria-describedby'))
  })
})

describe('SidePanel — fechamento', () => {
  it('fecha pelo botão de fechar, rotulado com o título', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    render(
      <SidePanel titulo="Nova saída" onFechar={onFechar}>
        <p>corpo</p>
      </SidePanel>
    )

    await user.click(screen.getByRole('button', { name: 'Fechar Nova saída' }))
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('fecha com Esc', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    render(
      <SidePanel titulo="Nova saída" onFechar={onFechar}>
        <p>corpo</p>
      </SidePanel>
    )

    await user.keyboard('{Escape}')
    expect(onFechar).toHaveBeenCalledOnce()
  })

  it('fecha ao clicar no overlay, por padrão', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const { container } = render(
      <SidePanel titulo="Nova saída" onFechar={onFechar}>
        <p>corpo</p>
      </SidePanel>
    )

    const overlay = container.firstElementChild as HTMLElement
    await user.click(overlay)
    expect(onFechar).toHaveBeenCalledOnce()
  })

  // Formulário com dado digitado: um clique fora não pode descartar o que foi
  // preenchido. Mesmo motivo pelo qual o ConfirmDialog trava o overlay em ação
  // destrutiva.
  it('não fecha no overlay quando fecharNoOverlay é false', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    const { container } = render(
      <SidePanel titulo="Nova saída" onFechar={onFechar} fecharNoOverlay={false}>
        <p>corpo</p>
      </SidePanel>
    )

    const overlay = container.firstElementChild as HTMLElement
    await user.click(overlay)
    expect(onFechar).not.toHaveBeenCalled()
  })

  it('clicar dentro do painel nunca fecha', async () => {
    const user = userEvent.setup()
    const onFechar = vi.fn()
    render(
      <SidePanel titulo="Nova saída" onFechar={onFechar}>
        <p>corpo</p>
      </SidePanel>
    )

    await user.click(screen.getByText('corpo'))
    expect(onFechar).not.toHaveBeenCalled()
  })
})

describe('SidePanel — foco', () => {
  it('leva o foco para dentro do painel ao abrir', async () => {
    render(
      <SidePanel titulo="Nova saída" onFechar={() => {}}>
        <input aria-label="Descrição" />
      </SidePanel>
    )

    const dialogo = screen.getByRole('dialog')
    expect(dialogo.contains(document.activeElement)).toBe(true)
  })

  it('devolve o foco ao gatilho quando o painel desmonta', async () => {
    const user = userEvent.setup()

    function Host() {
      const [aberto, setAberto] = useState(false)
      return (
        <>
          <button onClick={() => setAberto(true)}>Nova saída</button>
          {aberto && (
            <SidePanel titulo="Nova saída" onFechar={() => setAberto(false)}>
              <input aria-label="Descrição" />
            </SidePanel>
          )}
        </>
      )
    }

    render(<Host />)
    const gatilho = screen.getByRole('button', { name: 'Nova saída' })
    await user.click(gatilho)
    expect(screen.getByRole('dialog')).toBeTruthy()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(gatilho)
  })
})
