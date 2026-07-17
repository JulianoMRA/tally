import { Notification } from 'electron'
import type { Database } from '../src/persistence/database'
import { FaturaRepository } from '../src/persistence/repositories/fatura-repository'
import { lerConfig } from '../src/persistence/settings'
import { hojeIsoLocal } from '../src/shared/datas-locais'
import { diferencaEmDias, somarDias } from '../src/domain/services/mes-referencia'

// Dedup em memoria: cada fatura avisa no maximo uma vez por dia por tipo.
// Reiniciar o app zera o conjunto — comportamento desejado (novo boot, novo
// lembrete, ate o usuario agir ou o evento passar).
const avisadas = new Set<string>()

/**
 * Fase 7 (RF-CFG-01) — dispara notificacoes do SO para faturas Abertas
 * prestes a fechar e Fechadas prestes a vencer, dentro da janela de
 * `diasAntecedenciaAviso` das configuracoes. Respeita `notificacoesAtivas`.
 * Chamado no boot e no timer horario do main.
 */
export function verificarAvisos(db: Database, settingsPath: string): number {
  const config = lerConfig(settingsPath)
  if (!config.notificacoesAtivas || !Notification.isSupported()) return 0

  const hoje = hojeIsoLocal()
  const ateData = somarDias(hoje, config.diasAntecedenciaAviso)
  const avisos = new FaturaRepository(db).listarAvisos(hoje, ateData)

  let disparadas = 0
  for (const aviso of avisos) {
    const chave = `${aviso.tipo}:${aviso.fatura.id}:${hoje}`
    if (avisadas.has(chave)) continue
    avisadas.add(chave)

    const data =
      aviso.tipo === 'fechamento' ? aviso.fatura.dataFechamento : aviso.fatura.dataVencimento
    const dias = diferencaEmDias(hoje, data)
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`
    const acao = aviso.tipo === 'fechamento' ? 'fecha' : 'vence'

    new Notification({
      title: `Fatura ${aviso.cartaoNome} ${acao} ${quando}`,
      body: `Mês de referência ${aviso.fatura.mesReferencia}. Abra o Tally para conferir.`
    }).show()
    disparadas++
  }
  return disparadas
}
