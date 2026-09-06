import { Notification } from 'electron'
import type { Database } from '../src/persistence/database'
import { FaturaRepository } from '../src/persistence/repositories/fatura-repository'
import { lerConfig } from '../src/persistence/settings'
import { hojeIsoLocal } from '../src/shared/datas-locais'
import { diferencaEmDias, somarDias } from '../src/domain/services/mes-referencia'

// Dedup em memoria: cada fatura avisa no maximo uma vez por dia por tipo.
// Reiniciar o app zera o conjunto — comportamento desejado (novo boot, novo
// lembrete, ate o usuario agir ou o evento passar).
//
// O conjunto guarda o DIA a que pertence e e esvaziado na virada. Antes a data
// entrava na propria chave (`tipo:id:data`), o que dava o mesmo dedup mas
// impedia qualquer limpeza: a entrada de ontem nunca mais casava e tambem
// nunca saia. Num app que fica aberto o dia inteiro — e que tem um timer
// horario chamando isto — o conjunto so crescia. Agora o tamanho e o numero de
// faturas em janela, e nao o acumulado de dias abertos.
let diaMemorizado: string | null = null
const avisadas = new Set<string>()

/** Diagnostico: quantas chaves o dedup mantem. Usado nos testes. */
export function avisosMemorizados(): number {
  return avisadas.size
}

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
  if (diaMemorizado !== hoje) {
    avisadas.clear()
    diaMemorizado = hoje
  }
  const ateData = somarDias(hoje, config.diasAntecedenciaAviso)
  const avisos = new FaturaRepository(db).listarAvisos(hoje, ateData)

  let disparadas = 0
  for (const aviso of avisos) {
    const chave = `${aviso.tipo}:${aviso.fatura.id}`
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
