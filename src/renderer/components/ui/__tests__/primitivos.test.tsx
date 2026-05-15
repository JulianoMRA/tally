import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { Button } from '../Button'
import { Badge } from '../Badge'
import { Panel } from '../Panel'
import { EmptyState } from '../EmptyState'
import { Field } from '../Field'

describe('Button', () => {
  it('renders with default variant', () => {
    const html = renderToStaticMarkup(<Button>Salvar</Button>)
    expect(html).toContain('Salvar')
    expect(html).toContain('<button')
  })

  it('renders primary variant', () => {
    const html = renderToStaticMarkup(<Button variant="primary">OK</Button>)
    expect(html).toContain('primary')
  })

  it('renders disabled state', () => {
    const html = renderToStaticMarkup(<Button disabled>Bloqueado</Button>)
    expect(html).toContain('disabled')
  })
})

describe('Badge', () => {
  it('renders label for open variant', () => {
    const html = renderToStaticMarkup(<Badge variant="open" />)
    expect(html).toContain('Aberta')
  })

  it('renders label for paid variant', () => {
    const html = renderToStaticMarkup(<Badge variant="paid" />)
    expect(html).toContain('Paga')
  })

  it('uses custom label when provided', () => {
    const html = renderToStaticMarkup(<Badge variant="active" label="Em uso" />)
    expect(html).toContain('Em uso')
  })
})

describe('Panel', () => {
  it('renders title and children', () => {
    const html = renderToStaticMarkup(<Panel title="Faturas">conteúdo</Panel>)
    expect(html).toContain('Faturas')
    expect(html).toContain('conteúdo')
  })

  it('renders meta when provided', () => {
    const html = renderToStaticMarkup(
      <Panel title="X" meta="3 itens">
        -
      </Panel>
    )
    expect(html).toContain('3 itens')
  })
})

describe('EmptyState', () => {
  it('renders title', () => {
    const html = renderToStaticMarkup(<EmptyState title="Nada aqui" />)
    expect(html).toContain('Nada aqui')
  })

  it('renders description when provided', () => {
    const html = renderToStaticMarkup(<EmptyState title="Vazio" description="Adicione um item." />)
    expect(html).toContain('Adicione um item.')
  })
})

describe('Field', () => {
  it('renders label', () => {
    const html = renderToStaticMarkup(
      <Field label="Nome">
        <input />
      </Field>
    )
    expect(html).toContain('Nome')
  })

  it('renders error message', () => {
    const html = renderToStaticMarkup(
      <Field label="Nome" error="Campo obrigatório">
        <input />
      </Field>
    )
    expect(html).toContain('Campo obrigatório')
  })
})
