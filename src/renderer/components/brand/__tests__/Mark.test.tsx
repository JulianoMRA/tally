import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { Mark } from '../Mark'

describe('Mark', () => {
  it('renders primary variant with an svg', () => {
    const html = renderToStaticMarkup(<Mark variant="primary" />)
    expect(html).toContain('<svg')
    expect(html).toContain('viewBox="0 0 64 64"')
  })

  it('renders tally variant with stroke lines', () => {
    const html = renderToStaticMarkup(<Mark variant="tally" />)
    expect(html).toContain('<line')
  })

  it('renders stack variant', () => {
    const html = renderToStaticMarkup(<Mark variant="stack" />)
    expect(html).toContain('<svg')
  })

  it('renders monogram variant', () => {
    const html = renderToStaticMarkup(<Mark variant="monogram" />)
    expect(html).toContain('<svg')
  })

  it('includes background rect when bg is set', () => {
    const html = renderToStaticMarkup(<Mark variant="primary" bg="#fff" />)
    expect(html).toContain('<rect')
    expect(html).toContain('fill="#fff"')
  })

  it('omits background rect when bg is none', () => {
    const html = renderToStaticMarkup(<Mark variant="primary" bg="none" />)
    expect(html.match(/<rect/g)?.length ?? 0).toBeGreaterThan(0)
    expect(html).not.toContain('fill="none"')
  })

  it('applies custom size', () => {
    const html = renderToStaticMarkup(<Mark size={48} />)
    expect(html).toContain('width="48"')
    expect(html).toContain('height="48"')
  })
})
