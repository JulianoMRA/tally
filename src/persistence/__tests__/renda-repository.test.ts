import { describe, it, expect, beforeEach } from 'vitest'
import type { Database } from '../database'
import { openInMemoryDatabase } from '../database'
import { runMigrations } from '../migrations/runner'
import { RendaRepository } from '../repositories/renda-repository'

describe('RendaRepository', () => {
  let db: Database
  let repo: RendaRepository

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    repo = new RendaRepository(db)
  })

  // Estes testes so precisam de "uma renda qualquer". Usavam `criarAvulsa`
  // por ser a criacao mais barata; desde a 0011 so existe Recorrente.
  function fonte(nome: string, valorPadraoCentavos = 50000) {
    return repo.criarRecorrente({
      nome,
      valorPadraoCentavos,
      diaEsperado: 5,
      dataInicio: '2026-06-01'
    }).renda
  }

  describe('criarRecorrente (RF-REN-02)', () => {
    it('cria renda + 12 recebimentos com status Esperado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa PET',
        valorPadraoCentavos: 120000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      expect(r.renda.tipo).toBe('Recorrente')
      expect(r.renda.diaEsperado).toBe(5)
      expect(r.recebimentos).toHaveLength(12)
      for (const rec of r.recebimentos) {
        expect(rec.status).toBe('Esperado')
        expect(rec.valorCentavos).toBe(120000)
        expect(rec.rendaId).toBe(r.renda.id)
        expect(rec.dataRecebida).toBeNull()
      }
    })

    it('primeira data respeita o diaEsperado', () => {
      const r = repo.criarRecorrente({
        nome: 'X',
        valorPadraoCentavos: 1000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })
      expect(r.recebimentos[0].dataEsperada).toBe('2026-06-05')
    })

    it('é atômico — schema CHECK rejeita dia 0 e reverte tudo', () => {
      expect(() =>
        repo.criarRecorrente({
          nome: 'X',
          valorPadraoCentavos: 1000,
          diaEsperado: 0, // viola CHECK do schema mas também o service throw
          dataInicio: '2026-06-01'
        })
      ).toThrow()

      const n = (db.prepare('SELECT count(*) as n FROM renda').get() as { n: number }).n
      expect(n).toBe(0)
    })
  })

  describe('list', () => {
    it('retorna ativas por padrão ordenadas por nome', () => {
      fonte('Zelda', 1000)
      fonte('Anna', 2000)

      const lista = repo.list()
      expect(lista.map((r) => r.nome)).toEqual(['Anna', 'Zelda'])
    })

    it('incluirArquivadas=true traz arquivadas também', () => {
      const a = fonte('A', 1000)
      fonte('B', 2000)
      repo.arquivar(a.id)

      expect(repo.list()).toHaveLength(1)
      expect(repo.list({ incluirArquivadas: true })).toHaveLength(2)
    })
  })

  describe('update — RF-REN-05', () => {
    it('reajuste do valor padrão afeta recebimentos Esperado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      repo.update(r.renda.id, {
        nome: 'Bolsa',
        valorPadraoCentavos: 130000
      })

      const recebimentos = db
        .prepare('SELECT * FROM recebimento WHERE renda_id = ?')
        .all(r.renda.id) as { valor_centavos: number; status: string }[]

      for (const rec of recebimentos) {
        expect(rec.valor_centavos).toBe(130000)
      }
    })

    it('não toca em recebimentos Recebido', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      // Marca o primeiro como Recebido
      db.prepare(
        "UPDATE recebimento SET status = 'Recebido', data_recebida = '2026-06-05' WHERE id = ?"
      ).run(r.recebimentos[0].id)

      repo.update(r.renda.id, {
        nome: 'Bolsa',
        valorPadraoCentavos: 130000
      })

      const primeiro = db
        .prepare('SELECT * FROM recebimento WHERE id = ?')
        .get(r.recebimentos[0].id) as { valor_centavos: number; status: string }
      expect(primeiro.valor_centavos).toBe(100000)
      expect(primeiro.status).toBe('Recebido')
    })

    it('lança erro para id inexistente', () => {
      expect(() => repo.update(9999, { nome: 'X', valorPadraoCentavos: 1000 })).toThrow()
    })

    it('RF-REN-06: muda diaEsperado e recalcula data_esperada dos Esperados', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })
      // Confirma data inicial dia 5
      expect(r.recebimentos[0].dataEsperada).toBe('2026-06-05')

      repo.update(r.renda.id, {
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 15
      })

      const recebimentos = db
        .prepare(
          'SELECT data_esperada FROM recebimento WHERE renda_id = ? ORDER BY data_esperada ASC'
        )
        .all(r.renda.id) as { data_esperada: string }[]
      // Todos os 12 Esperados agora caem no dia 15
      for (const rec of recebimentos) {
        expect(rec.data_esperada.endsWith('-15')).toBe(true)
      }
    })

    it('RF-REN-06: clampa diaEsperado em meses curtos (dia 31 → 30 em abril)', () => {
      const r = repo.criarRecorrente({
        nome: 'X',
        valorPadraoCentavos: 1000,
        diaEsperado: 1,
        dataInicio: '2026-03-01'
      })

      repo.update(r.renda.id, {
        nome: 'X',
        valorPadraoCentavos: 1000,
        diaEsperado: 31
      })

      const recebimentos = db
        .prepare(
          'SELECT data_esperada FROM recebimento WHERE renda_id = ? ORDER BY data_esperada ASC'
        )
        .all(r.renda.id) as { data_esperada: string }[]
      const abril = recebimentos.find((r) => r.data_esperada.startsWith('2026-04'))
      expect(abril?.data_esperada).toBe('2026-04-30')
    })
  })

  describe('arquivar', () => {
    it('apaga recebimentos Esperado e preserva Recebido', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      // Marca o primeiro como Recebido
      db.prepare(
        "UPDATE recebimento SET status = 'Recebido', data_recebida = '2026-06-05' WHERE id = ?"
      ).run(r.recebimentos[0].id)

      const arquivada = repo.arquivar(r.renda.id)
      expect(arquivada.ativa).toBe(false)

      const restantes = db
        .prepare('SELECT * FROM recebimento WHERE renda_id = ?')
        .all(r.renda.id) as { id: number; status: string }[]

      expect(restantes).toHaveLength(1)
      expect(restantes[0].status).toBe('Recebido')
    })
  })

  describe('desarquivar', () => {
    it('volta ativa para true mas não regenera recebimentos', () => {
      const r = fonte('X', 1000)
      repo.arquivar(r.id)
      const d = repo.desarquivar(r.id)
      expect(d.ativa).toBe(true)
    })
  })

  describe('estenderHorizonteRecorrentes (RF-VIS-04, RN-04)', () => {
    function mesesGerados(rendaId: number): string[] {
      type Row = { mes: string }
      const rows = db
        .prepare(
          `SELECT substr(data_esperada, 1, 7) AS mes FROM recebimento
           WHERE renda_id = ?
           ORDER BY data_esperada ASC`
        )
        .all(rendaId) as Row[]
      return rows.map((r) => r.mes)
    }

    it('não cria nada quando o mes alvo está dentro do horizonte pré-gerado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      const antes = mesesGerados(r.renda.id)
      const resultado = repo.estenderHorizonteRecorrentes('2027-03')
      const depois = mesesGerados(r.renda.id)

      expect(resultado.recebimentosCriados).toBe(0)
      expect(depois).toEqual(antes)
    })

    it('estende em N meses quando alvo está além do horizonte', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      // horizonte inicial: jun/2026 .. mai/2027
      const resultado = repo.estenderHorizonteRecorrentes('2027-11')

      expect(resultado.recebimentosCriados).toBe(6)

      const meses = mesesGerados(r.renda.id)
      expect(meses).toHaveLength(18)
      expect(meses[meses.length - 1]).toBe('2027-11')

      const rows = db
        .prepare(
          "SELECT valor_centavos, status FROM recebimento WHERE renda_id = ? AND substr(data_esperada, 1, 7) > '2027-05'"
        )
        .all(r.renda.id) as { valor_centavos: number; status: string }[]
      for (const row of rows) {
        expect(row.valor_centavos).toBe(100000)
        expect(row.status).toBe('Esperado')
      }
    })

    it('clampa diaEsperado em meses curtos (fev 31 → fev 28/29)', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 31,
        dataInicio: '2026-06-01'
      })

      // horizonte inicial cobre até mai/2027; estendemos até fev/2028 (bissexto)
      repo.estenderHorizonteRecorrentes('2028-02')

      const datas = db
        .prepare(
          "SELECT data_esperada FROM recebimento WHERE renda_id = ? AND substr(data_esperada, 1, 7) IN ('2028-02', '2027-11', '2027-09')"
        )
        .all(r.renda.id) as { data_esperada: string }[]
      const map = new Map(datas.map((d) => [d.data_esperada.slice(0, 7), d.data_esperada]))
      expect(map.get('2028-02')).toBe('2028-02-29')
      expect(map.get('2027-11')).toBe('2027-11-30')
      expect(map.get('2027-09')).toBe('2027-09-30')
    })

    it('é idempotente: chamar duas vezes para o mesmo mes não duplica', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      repo.estenderHorizonteRecorrentes('2027-10')
      const segunda = repo.estenderHorizonteRecorrentes('2027-10')

      expect(segunda.recebimentosCriados).toBe(0)
      const meses = mesesGerados(r.renda.id)
      expect(new Set(meses).size).toBe(meses.length)
    })

    it('não retroage: mes alvo no passado é ignorado', () => {
      const r = repo.criarRecorrente({
        nome: 'Bolsa',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })

      const resultado = repo.estenderHorizonteRecorrentes('2026-01')
      expect(resultado.recebimentosCriados).toBe(0)
      expect(mesesGerados(r.renda.id)).toHaveLength(12)
    })

    it('ignora rendas arquivadas', () => {
      const recorrenteArquivada = repo.criarRecorrente({
        nome: 'Antiga',
        valorPadraoCentavos: 100000,
        diaEsperado: 5,
        dataInicio: '2026-06-01'
      })
      repo.arquivar(recorrenteArquivada.renda.id)

      const resultado = repo.estenderHorizonteRecorrentes('2028-01')

      expect(resultado.recebimentosCriados).toBe(0)
    })
  })
})
