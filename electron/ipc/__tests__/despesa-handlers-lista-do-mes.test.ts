import { describe, it, expect, beforeEach } from 'vitest'
import type { IpcMain } from 'electron'
import type { Database } from '../../../src/persistence/database'
import { openInMemoryDatabase } from '../../../src/persistence/database'
import { runMigrations } from '../../../src/persistence/migrations/runner'
import { DespesaRepository } from '../../../src/persistence/repositories/despesa-repository'
import { FaturaRepository } from '../../../src/persistence/repositories/fatura-repository'
import { ParcelaRepository } from '../../../src/persistence/repositories/parcela-repository'
import { DESPESA_IPC_CHANNELS, type OcorrenciaDoMes } from '../../../src/shared/ipc/despesa'
import { registerDespesaHandlers } from '../despesa-handlers'

type Handler = (evento: unknown, payload: unknown) => unknown

/** `ipcMain` falso, como em `despesa-handlers-ocorrencia.test.ts`. */
function ipcMainFalso(): {
  ipcMain: IpcMain
  invocar: (canal: string, payload?: unknown) => unknown
} {
  const handlers = new Map<string, Handler>()
  const ipcMain = {
    handle: (canal: string, handler: Handler) => handlers.set(canal, handler)
  } as unknown as IpcMain

  return {
    ipcMain,
    invocar: (canal, payload) => {
      const handler = handlers.get(canal)
      if (!handler) throw new Error(`Canal nao registrado: ${canal}`)
      return handler({}, payload)
    }
  }
}

/**
 * A lista do mês de Saídas na fronteira do IPC (RF-DES-09, RF-DES-10).
 *
 * Saídas oferecia Excluir em toda linha e só descobria o bloqueio depois do
 * diálogo "irreversível", e o modal de edição deixava mudar valor e data da
 * compra à vista cuja fatura já tinha fechado, para recusar ao salvar. A tela
 * de Faturas já sabia das duas coisas; Saídas não recebia o que precisava para
 * saber. A regra de exclusão olha TODAS as parcelas da despesa, e o mês só
 * conhece as dele: quem responde é o main.
 */
describe('lista de ocorrências do mês: status da fatura e bloqueio de exclusão', () => {
  let db: Database
  let ipc: ReturnType<typeof ipcMainFalso>
  let repo: DespesaRepository
  let catId: number
  let cartaoId: number

  beforeEach(() => {
    db = openInMemoryDatabase()
    runMigrations(db)
    ipc = ipcMainFalso()
    registerDespesaHandlers(db, ipc.ipcMain)
    repo = new DespesaRepository(db)

    cartaoId = Number(
      db
        .prepare(
          "INSERT INTO cartao (nome, dia_fechamento, dia_vencimento, cor) VALUES ('Inter', 5, 12, '#000')"
        )
        .run().lastInsertRowid
    )
    catId = Number(
      db.prepare("INSERT INTO categoria (nome, cor) VALUES ('Casa', '#aaa')").run().lastInsertRowid
    )
  })

  function listarDoMes(mesReferencia: string): OcorrenciaDoMes[] {
    return ipc.invocar(DESPESA_IPC_CHANNELS.listarOcorrenciasDoMes, {
      mesReferencia
    }) as OcorrenciaDoMes[]
  }

  function linha(lista: OcorrenciaDoMes[], descricao: string): OcorrenciaDoMes {
    const encontrada = lista.find((o) => o.descricao === descricao)
    if (!encontrada) throw new Error(`Sem a linha "${descricao}"`)
    return encontrada
  }

  it('a ocorrência em fatura traz o status dela; fora de cartão, não traz', () => {
    const almoco = repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2026-06-03'
    })
    repo.criarUnicaForaCartao({
      descricao: 'Feira',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorCentavos: 8000,
      dataCompra: '2026-06-10'
    })
    new FaturaRepository(db).fechar(almoco.fatura.id)

    const lista = listarDoMes('2026-06')

    expect(linha(lista, 'Almoço').statusFatura).toBe('Fechada')
    expect(linha(lista, 'Feira').statusFatura).toBeUndefined()
  })

  it('compra à vista em fatura fechada vem com o motivo do bloqueio', () => {
    const almoco = repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2026-06-03'
    })
    new FaturaRepository(db).fechar(almoco.fatura.id)

    expect(linha(listarDoMes('2026-06'), 'Almoço').motivoBloqueioExclusao).toBe(
      'has-parcela-em-fatura-fechada'
    )
  })

  // O caso que a linha do mês não tinha como ver: a parcela 2/3 está numa
  // fatura Aberta, mas a 1/3 já fechou.
  it('parcelada com uma parcela em fatura fechada vem bloqueada no mês em que a parcela está aberta', () => {
    const tv = repo.criarParceladaCredito({
      descricao: 'TV',
      categoriaId: catId,
      cartaoId,
      totalParcelas: 3,
      valorTotalCentavos: 3000,
      dataCompra: '2026-06-03'
    })
    new FaturaRepository(db).fechar(tv.parcelas[0].faturaId!)

    const julho = linha(listarDoMes('2026-07'), 'TV')

    expect(julho.statusFatura).toBe('Aberta')
    expect(julho.motivoBloqueioExclusao).toBe('has-parcela-em-fatura-fechada')
  })

  it('ocorrência fora do cartão já paga vem com o motivo de parcela paga', () => {
    const feira = repo.criarUnicaForaCartao({
      descricao: 'Feira',
      categoriaId: catId,
      formaPagamento: 'Pix',
      valorCentavos: 8000,
      dataCompra: '2026-06-10'
    })
    new ParcelaRepository(db).marcarPaga(feira.parcela.id, '2026-06-10')

    expect(linha(listarDoMes('2026-06'), 'Feira').motivoBloqueioExclusao).toBe('has-parcela-paga')
  })

  it('despesa que pode ser excluída não traz motivo', () => {
    repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2026-06-03'
    })

    const almoco = linha(listarDoMes('2026-06'), 'Almoço')

    expect(almoco.statusFatura).toBe('Aberta')
    expect(almoco.motivoBloqueioExclusao).toBeUndefined()
  })

  // A busca por período não oferece ações de linha: calcular o bloqueio de
  // cada despesa de um intervalo inteiro seria trabalho jogado fora. O status
  // da fatura vem do próprio JOIN e sai nas duas.
  it('a busca por período traz o status da fatura, e não o bloqueio', () => {
    const almoco = repo.criarUnicaCredito({
      descricao: 'Almoço',
      categoriaId: catId,
      cartaoId,
      valorCentavos: 2500,
      dataCompra: '2026-06-03'
    })
    new FaturaRepository(db).fechar(almoco.fatura.id)

    const resultado = ipc.invocar(DESPESA_IPC_CHANNELS.buscarOcorrencias, {
      mesInicio: '2026-06',
      mesFim: '2026-06'
    }) as OcorrenciaDoMes[]

    expect(linha(resultado, 'Almoço').statusFatura).toBe('Fechada')
    expect(linha(resultado, 'Almoço').motivoBloqueioExclusao).toBeUndefined()
  })
})
