import { dialog, type BrowserWindow, type IpcMain } from 'electron'
import { writeFileSync } from 'fs'
import type { Database } from '../../src/persistence/database'
import { importarLinhas } from '../../src/persistence/importacao'
import { montarLinhasDoMes } from '../../src/persistence/exportacao'
import { serializarCsv } from '../../src/shared/csv/gerar-csv'
import {
  importarCsvInputSchema,
  exportarMesInputSchema,
  DADOS_IPC_CHANNELS
} from '../../src/shared/ipc/importacao'
import { gerarPdfDoMes } from '../exportar-pdf'

type JanelaAtual = () => BrowserWindow | undefined

export function registerDadosHandlers(
  db: Database,
  ipcMain: IpcMain,
  janelaAtual: JanelaAtual
): void {
  ipcMain.handle(DADOS_IPC_CHANNELS.importarCsv, (_event, payload: unknown) => {
    const { linhas } = importarCsvInputSchema.parse(payload)
    return importarLinhas(db, linhas)
  })

  ipcMain.handle(DADOS_IPC_CHANNELS.exportarMesCsv, async (_event, payload: unknown) => {
    const { mesReferencia } = exportarMesInputSchema.parse(payload)
    const win = janelaAtual()
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar mês em CSV',
      defaultPath: `tally-${mesReferencia}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (canceled || !filePath) return null
    const { header, linhas } = montarLinhasDoMes(db, mesReferencia)
    // BOM UTF-8: Excel pt-BR só reconhece acentuação com ele.
    writeFileSync(filePath, '﻿' + serializarCsv(header, linhas), 'utf8')
    return filePath
  })

  ipcMain.handle(DADOS_IPC_CHANNELS.exportarMesPdf, async (_event, payload: unknown) => {
    const { mesReferencia } = exportarMesInputSchema.parse(payload)
    const win = janelaAtual()
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar mês em PDF',
      defaultPath: `tally-${mesReferencia}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    const pdf = await gerarPdfDoMes(mesReferencia)
    writeFileSync(filePath, pdf)
    return filePath
  })
}
