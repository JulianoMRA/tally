import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  configSchema,
  configArquivoSchema,
  CONFIG_DEFAULTS,
  type Config
} from '../shared/ipc/config'

/**
 * Le a configuracao do app de um settings.json. Arquivo ausente, ilegivel,
 * JSON invalido ou shape invalido caem nos defaults — configuracao quebrada
 * nunca impede o boot. Campos ausentes (arquivo de versao antiga) assumem o
 * default individualmente.
 */
export function lerConfig(caminho: string): Config {
  if (!existsSync(caminho)) return CONFIG_DEFAULTS
  try {
    const conteudo = readFileSync(caminho, 'utf8')
    return configArquivoSchema.parse(JSON.parse(conteudo))
  } catch {
    return CONFIG_DEFAULTS
  }
}

/** Valida e grava a configuracao. Configuracao invalida lanca sem tocar o arquivo. */
export function gravarConfig(caminho: string, config: Config): Config {
  const valida = configSchema.parse(config)
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, JSON.stringify(valida, null, 2), 'utf8')
  return valida
}
