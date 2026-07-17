export type ResultadoParseCsv = {
  header: string[]
  linhas: string[][]
  delimitador: ';' | ','
}

/**
 * Parser CSV minimo (RFC 4180) para os templates de importacao do Tally:
 * campos entre aspas duplas podem conter delimitador, quebra de linha e
 * aspas escapadas (""). Delimitador padrao pt-BR e ';' (Excel/Sheets em
 * portugues); cai para ',' quando o header nao contem ';'. BOM UTF-8 e
 * removido; linhas vazias sao ignoradas; espacos ao redor de campos
 * nao-citados sao aparados.
 *
 * Puro e sem dependencias — roda no renderer (preview) e no main (validacao).
 */
export function parseCsv(conteudo: string): ResultadoParseCsv {
  const semBom = conteudo.replace(/^﻿/, '')
  if (semBom.trim().length === 0) {
    throw new Error('Arquivo vazio.')
  }

  const primeiraLinha = semBom.slice(0, indiceFimDaLinha(semBom))
  const delimitador: ';' | ',' = contarForaDeAspas(primeiraLinha, ';') > 0 ? ';' : ','

  const registros = tokenizar(semBom, delimitador)
  const naoVazios = registros.filter((r) => !(r.length === 1 && r[0] === ''))

  if (naoVazios.length === 0) {
    throw new Error('Arquivo vazio.')
  }
  const [header, ...linhas] = naoVazios
  if (linhas.length === 0) {
    throw new Error('Nenhuma linha de dados após o cabeçalho.')
  }

  linhas.forEach((linha, i) => {
    if (linha.length !== header.length) {
      throw new Error(
        `Linha ${i + 2}: esperava ${header.length} campo(s) como no cabeçalho, encontrou ${linha.length}.`
      )
    }
  })

  return { header, linhas, delimitador }
}

function indiceFimDaLinha(s: string): number {
  const idx = s.search(/\r?\n/)
  return idx === -1 ? s.length : idx
}

function contarForaDeAspas(linha: string, alvo: string): number {
  let dentro = false
  let n = 0
  for (const ch of linha) {
    if (ch === '"') dentro = !dentro
    else if (ch === alvo && !dentro) n++
  }
  return n
}

function tokenizar(conteudo: string, delimitador: string): string[][] {
  const registros: string[][] = []
  let registro: string[] = []
  let campo = ''
  let citado = false
  let dentroDeAspas = false
  let i = 0

  const fechaCampo = (): void => {
    registro.push(citado ? campo : campo.trim())
    campo = ''
    citado = false
  }
  const fechaRegistro = (): void => {
    fechaCampo()
    registros.push(registro)
    registro = []
  }

  while (i < conteudo.length) {
    const ch = conteudo[i]
    if (dentroDeAspas) {
      if (ch === '"') {
        if (conteudo[i + 1] === '"') {
          campo += '"'
          i += 2
          continue
        }
        dentroDeAspas = false
        i++
        continue
      }
      campo += ch
      i++
      continue
    }

    if (ch === '"' && campo.trim() === '') {
      dentroDeAspas = true
      citado = true
      campo = ''
      i++
      continue
    }
    if (ch === delimitador) {
      fechaCampo()
      i++
      continue
    }
    if (ch === '\r' && conteudo[i + 1] === '\n') {
      fechaRegistro()
      i += 2
      continue
    }
    if (ch === '\n') {
      fechaRegistro()
      i++
      continue
    }
    campo += ch
    i++
  }

  if (dentroDeAspas) {
    throw new Error('Aspas abertas sem fechamento no fim do arquivo.')
  }
  fechaRegistro()
  return registros
}
