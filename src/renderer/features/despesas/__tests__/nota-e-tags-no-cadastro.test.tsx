// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Cartao } from '@domain/entities/cartao'
import type { Categoria } from '@domain/entities/categoria'
import type { NotaETags } from '@shared/ipc/despesa'
import { DespesaForm } from '../DespesaForm'

const CARTOES = [
  { id: 1, nome: 'Inter', diaFechamento: 5, diaVencimento: 12, cor: '#a88454', ativo: true }
] as unknown as Cartao[]

const CATEGORIAS = [{ id: 7, nome: 'Casa', cor: '#3f6e47', ativo: true }] as unknown as Categoria[]

function montar(overrides: Partial<Parameters<typeof DespesaForm>[0]> = {}) {
  const onSalvarUnica = vi.fn().mockResolvedValue(undefined)
  render(
    <DespesaForm
      cartoes={CARTOES}
      categorias={CATEGORIAS}
      onSalvarUnica={onSalvarUnica}
      onSalvarUnicaForaCartao={vi.fn()}
      onSalvarParcelada={vi.fn()}
      onSalvarEmAndamento={vi.fn()}
      onSalvarAssinatura={vi.fn()}
      onSalvarAssinaturaForaCartao={vi.fn()}
      {...overrides}
    />
  )
  return { onSalvarUnica }
}

async function preencherMinimo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Descrição/), 'Notebook')
  await user.selectOptions(screen.getByLabelText(/Categoria/), '7')
  await user.selectOptions(screen.getByLabelText(/Cartão/), '1')
  await user.type(screen.getByLabelText(/Valor/), '500,00')
  await user.type(screen.getByLabelText(/Data da compra/), '2026-09-08')
}

/**
 * RF-DES-13 no cadastro. Antes disto, registrar e etiquetar eram dois
 * episódios: salvava-se a despesa, procurava-se a linha na lista, abria-se o
 * menu e só então o modal.
 */
describe('nota e tags no cadastro de despesa', () => {
  afterEach(cleanup)

  it('começa colapsado, para não cobrar altura de quem não usa', () => {
    montar()

    const gatilho = screen.getByRole('button', { name: /nota e tags/i })
    expect(gatilho.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Nota')).toBeNull()
  })

  it('entrega nota e tags junto do input ao salvar', async () => {
    const user = userEvent.setup()
    const { onSalvarUnica } = montar()

    await preencherMinimo(user)
    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nota'), 'reembolsável pelo trabalho')
    await user.type(screen.getByLabelText('Nova tag'), 'trabalho{Enter}')
    await user.type(screen.getByLabelText('Nova tag'), 'eletronicos{Enter}')
    await user.click(screen.getByRole('button', { name: 'Registrar despesa' }))

    expect(onSalvarUnica).toHaveBeenCalledTimes(1)
    const meta = onSalvarUnica.mock.calls[0][1] as NotaETags
    expect(meta.nota).toBe('reembolsável pelo trabalho')
    expect(meta.tags).toEqual(['trabalho', 'eletronicos'])
  })

  // Enter dentro de um <form> submete. Sem o preventDefault do editor, tentar
  // adicionar a primeira tag registraria a despesa.
  it('Enter no campo de tag adiciona a tag e NÃO submete o formulário', async () => {
    const user = userEvent.setup()
    const { onSalvarUnica } = montar()

    await preencherMinimo(user)
    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nova tag'), 'trabalho{Enter}')

    expect(onSalvarUnica).not.toHaveBeenCalled()
    expect(screen.getByText('trabalho')).toBeTruthy()
  })

  it('nota só de espaços vira null, e não uma nota em branco no banco', async () => {
    const user = userEvent.setup()
    const { onSalvarUnica } = montar()

    await preencherMinimo(user)
    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nota'), '   ')
    await user.click(screen.getByRole('button', { name: 'Registrar despesa' }))

    const meta = onSalvarUnica.mock.calls[0][1] as NotaETags
    expect(meta.nota).toBeNull()
  })

  it('tag repetida não entra duas vezes, ignorando caixa', async () => {
    const user = userEvent.setup()
    const { onSalvarUnica } = montar()

    await preencherMinimo(user)
    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nova tag'), 'Trabalho{Enter}')
    await user.type(screen.getByLabelText('Nova tag'), 'trabalho{Enter}')
    await user.click(screen.getByRole('button', { name: 'Registrar despesa' }))

    const meta = onSalvarUnica.mock.calls[0][1] as NotaETags
    expect(meta.tags).toEqual(['Trabalho'])
  })

  /**
   * O estado é único e não por aba, de propósito: quem digitou a nota e depois
   * percebeu que a compra era parcelada não deveria perder o que escreveu.
   */
  it('preserva o que foi digitado ao trocar de aba', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nova tag'), 'trabalho{Enter}')

    await user.click(screen.getByRole('radio', { name: 'Parcelada' }))
    await user.click(screen.getByRole('button', { name: /nota e tags/i }))

    expect(screen.getByText('trabalho')).toBeTruthy()
  })

  it('resume o que já foi preenchido no rótulo do gatilho', async () => {
    const user = userEvent.setup()
    montar()

    await user.click(screen.getByRole('button', { name: /nota e tags/i }))
    await user.type(screen.getByLabelText('Nova tag'), 'trabalho{Enter}')
    await user.type(screen.getByLabelText('Nova tag'), 'casa{Enter}')

    expect(screen.getByRole('button', { name: /nota e tags · 2 tags/i })).toBeTruthy()
  })
})
