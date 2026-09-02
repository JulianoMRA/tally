import { describe, it, expect } from 'vitest'
import { mesDivergenteDoPainel } from '../escopo-do-trilho'

describe('mesDivergenteDoPainel', () => {
  it('não acusa divergência quando o painel exibe a própria fatura corrente', () => {
    expect(mesDivergenteDoPainel('2026-09', '2026-09', true)).toBeNull()
  })

  // O caso relatado: os passadores levam o painel a dezembro e o card segue em
  // setembro, com dois totais na tela falando de faturas diferentes.
  it('devolve o mês do painel quando ele saiu da fatura corrente', () => {
    expect(mesDivergenteDoPainel('2026-09', '2026-12', true)).toBe('2026-12')
  })

  it('vale para o passado tanto quanto para o futuro', () => {
    expect(mesDivergenteDoPainel('2026-09', '2026-03', true)).toBe('2026-03')
  })

  // O painel é de um cartão só: card não selecionado não tem par com que
  // divergir, e marcar todos transformaria o aviso em ruído de fundo.
  it('só o cartão em foco pode divergir', () => {
    expect(mesDivergenteDoPainel('2026-09', '2026-12', false)).toBeNull()
  })

  it('não acusa nada quando o cartão não tem fatura corrente', () => {
    expect(mesDivergenteDoPainel(null, '2026-12', true)).toBeNull()
  })

  it('não acusa nada quando o painel não tem fatura aberta', () => {
    expect(mesDivergenteDoPainel('2026-09', null, true)).toBeNull()
  })
})
