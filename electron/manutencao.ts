import type { Database } from '../src/persistence/database'
import { FaturaRepository } from '../src/persistence/repositories/fatura-repository'
import { hojeIsoLocal } from '../src/shared/datas-locais'

/**
 * Manutenção periódica do main, isolada do Electron para ter teste — mesma
 * razão de `navegacao.ts`.
 *
 * **`obterBanco` é uma função de propósito.** A versão anterior recebia a
 * `Database` por parâmetro e a fechava no closure do `setInterval`. Só que
 * `reabrirBanco()` troca a conexão do módulo, e "Criar backup agora" e
 * "Restaurar backup" chamam exatamente isso: o timer continuava apontando para
 * a conexão fechada e toda execução seguinte morria em "Database already
 * closed". Como o `verificarAvisos` vem depois do `fecharVencidas` no mesmo
 * `try`, RN-06 e as notificações do SO paravam juntas, pelo resto da sessão e
 * sem sinal nenhum — o erro ia para o `console.error`, que binário empacotado
 * não tem para onde escrever.
 *
 * Ler a conexão a cada execução é o que mantém o timer válido através de
 * quantas trocas de arquivo o usuário fizer.
 */
export type ManutencaoPeriodicaDeps = {
  /** Lê a conexão VIVA a cada execução. Nunca guarde o retorno. */
  obterBanco: () => Database | null
  /** Notificações de fechamento/vencimento (RF-CFG-01). */
  avisar: (database: Database) => void
  /** Log informativo; só chamado quando alguma fatura fechou. */
  registrar: (mensagem: string) => void
  /** Destino da falha. Sem isto o erro se perde e a manutenção morre calada. */
  registrarFalha: (err: unknown) => void
  /** Injetável para teste determinístico; padrão `hojeIsoLocal`. */
  hoje?: () => string
}

/**
 * RN-06 — fecha faturas vencidas e dispara os avisos. Chamada pelo timer
 * horário do main, para cobrir a sessão longa que atravessa a virada do dia.
 * Nunca propaga: uma falha aqui não pode derrubar o timer.
 */
export function executarManutencaoPeriodica(deps: ManutencaoPeriodicaDeps): void {
  const database = deps.obterBanco()
  if (!database) return

  try {
    const hoje = (deps.hoje ?? hojeIsoLocal)()
    const fechadas = new FaturaRepository(database).fecharVencidas(hoje)
    if (fechadas > 0) {
      deps.registrar(`${fechadas} fatura(s) Aberta vencidas -> Fechada`)
    }
    deps.avisar(database)
  } catch (err) {
    deps.registrarFalha(err)
  }
}
