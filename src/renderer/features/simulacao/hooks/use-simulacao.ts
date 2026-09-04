import { useCallback, useEffect, useRef, useState } from 'react'
import type { SimulacaoDoMes } from '@domain/entities/simulacao'
import { SIMULACAO_VAZIA } from '@shared/ipc/simulacao'

/** Espera antes de gravar. Editar um valor dígito a dígito não pode virar um IPC por tecla. */
const ESPERA_GRAVACAO_MS = 400

function simulacaoVazia(): SimulacaoDoMes {
  return { base: { ...SIMULACAO_VAZIA.base }, itens: [] }
}

/**
 * Estado da simulação do mês, com gravação adiada.
 *
 * A gravação pendente é **descarregada antes de trocar de mês e ao sair da
 * tela**. Sem isso, a última tecla digitada antes de clicar em "próximo mês"
 * seria perdida — e num rascunho que só existe porque o usuário digitou, perder
 * a última alteração é perder a confiança na tela inteira.
 */
export function useSimulacao(mesReferencia: string) {
  const [simulacao, setSimulacao] = useState<SimulacaoDoMes>(simulacaoVazia)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const pendente = useRef<{ mes: string; simulacao: SimulacaoDoMes } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const gravarPendente = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    const alvo = pendente.current
    if (!alvo) return
    pendente.current = null
    try {
      await window.api.simulacao.salvar({
        mesReferencia: alvo.mes,
        simulacao: alvo.simulacao
      })
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar a simulação.')
    }
  }, [])

  const atualizar = useCallback(
    (proxima: SimulacaoDoMes) => {
      setSimulacao(proxima)
      pendente.current = { mes: mesReferencia, simulacao: proxima }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void gravarPendente()
      }, ESPERA_GRAVACAO_MS)
    },
    [mesReferencia, gravarPendente]
  )

  useEffect(() => {
    let cancelado = false
    setCarregando(true)

    async function carregar() {
      // Descarrega o que ficou pendente do mês anterior antes de ler o novo.
      await gravarPendente()
      try {
        const data = await window.api.simulacao.obter({ mesReferencia })
        if (!cancelado) {
          setSimulacao(data)
          setErro(null)
        }
      } catch (e) {
        if (!cancelado) {
          setSimulacao(simulacaoVazia())
          setErro(e instanceof Error ? e.message : 'Erro ao carregar a simulação.')
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      cancelado = true
    }
  }, [mesReferencia, gravarPendente])

  // Sair da tela com gravação pendente perderia a última edição.
  useEffect(() => {
    return () => {
      void gravarPendente()
    }
  }, [gravarPendente])

  return { simulacao, atualizar, carregando, erro }
}
