import { useCallback, useState } from 'react'
import type { OcorrenciaDoMes } from '@shared/ipc/despesa'
import { mensagemErro } from '../../../lib/mensagem-erro'
import type { PeriodoBusca } from '../periodo-busca'

/**
 * Carrega as ocorrências de um intervalo (RF-DES-22).
 *
 * Sob demanda, e não na montagem: a busca começa vazia e só consulta o banco
 * quando o usuário pede. Abrir a tela varrendo doze meses seria trabalho que
 * ninguém pediu — e a peneira de texto ainda estaria em branco, então o
 * resultado não responderia pergunta nenhuma.
 *
 * `try/catch/finally` completo desde o primeiro dia: é o defeito que a v1.6.2
 * corrigiu em sete cargas e que voltou a aparecer em Faturas na v1.14.0.
 */
export function useBusca() {
  const [resultados, setResultados] = useState<OcorrenciaDoMes[] | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const buscar = useCallback(async (periodo: PeriodoBusca) => {
    setCarregando(true)
    setErro(null)
    try {
      const linhas = await window.api.despesa.buscarOcorrencias(periodo)
      setResultados(linhas)
    } catch (e) {
      setErro(mensagemErro(e, 'Erro ao buscar lançamentos.'))
      // `null`, e não `[]`: lista vazia diria "nada encontrado", que é uma
      // afirmação sobre os dados. A busca falhou; não se sabe o que existe.
      setResultados(null)
    } finally {
      setCarregando(false)
    }
  }, [])

  const limpar = useCallback(() => {
    setResultados(null)
    setErro(null)
  }, [])

  return { resultados, carregando, erro, buscar, limpar }
}
