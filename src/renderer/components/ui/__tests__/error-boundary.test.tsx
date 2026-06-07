import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { ErrorScreen } from '../ErrorBoundary'

describe('ErrorScreen', () => {
  it('mostra mensagem amigável e botão de recarregar', () => {
    const html = renderToStaticMarkup(<ErrorScreen />)
    expect(html).toContain('Algo deu errado')
    expect(html).toContain('Recarregar')
  })

  it('tranquiliza o usuário sobre os dados salvos', () => {
    const html = renderToStaticMarkup(<ErrorScreen />)
    expect(html).toContain('dados continuam salvos')
  })

  it('exibe o detalhe técnico quando fornecido', () => {
    const html = renderToStaticMarkup(<ErrorScreen detalhe="boom 42" />)
    expect(html).toContain('boom 42')
  })

  it('omite o bloco de detalhe quando não há mensagem', () => {
    const html = renderToStaticMarkup(<ErrorScreen />)
    expect(html).not.toContain('<pre')
  })
})
