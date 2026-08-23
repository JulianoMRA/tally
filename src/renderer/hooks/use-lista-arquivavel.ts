import { useCallback, useEffect, useRef, useState } from 'react'
import { mensagemErro } from '../lib/mensagem-erro'

type Estado<T> = {
  itens: T[]
  loading: boolean
  error: string | null
}

/**
 * Lista com filtro de arquivados: carrega na montagem, recarrega quando o
 * filtro muda e expõe `refetch` para as mutações chamarem depois de salvar.
 *
 * Existia três vezes — `use-cartoes`, `use-categorias` e `use-rendas` —, sendo
 * as duas primeiras byte a byte iguais fora o nome da entidade. Cada cópia
 * traduzia a falha com `String(err)`, que entrega à tela o texto embrulhado
 * pelo Electron ("Error invoking remote method 'cartao:list': …"); as mutações
 * dessas mesmas telas já passavam por `mensagemErro`. Concentrar aqui é o que
 * faz as duas metades falarem a mesma língua.
 *
 * O nome do parâmetro do IPC varia entre os recursos (`incluirArquivados` para
 * cartão e categoria, `incluirArquivadas` para renda), então quem chama monta o
 * argumento — o hook só decide *quando* carregar.
 */
export function useListaArquivavel<T>(
  carregar: (incluirArquivados: boolean) => Promise<T[]>,
  erroPadrao: string
) {
  const [estado, setEstado] = useState<Estado<T>>({ itens: [], loading: true, error: null })
  const [incluirArquivados, setIncluirArquivados] = useState(false)

  // `carregar` e `erroPadrao` vivem em ref, e não nas dependências: o jeito
  // natural de chamar este hook é com um arrow inline, que é recriado a cada
  // render. Nas dependências, isso mudaria `refetch`, que dispararia o efeito,
  // que recarregaria — laço infinito. Medido: a versão com `carregar` na lista
  // derrubou o runner de teste por falta de memória.
  const carregarRef = useRef(carregar)
  const erroPadraoRef = useRef(erroPadrao)
  carregarRef.current = carregar
  erroPadraoRef.current = erroPadrao

  const refetch = useCallback(async () => {
    setEstado((e) => ({ ...e, loading: true, error: null }))
    try {
      const itens = await carregarRef.current(incluirArquivados)
      setEstado({ itens, loading: false, error: null })
    } catch (err) {
      setEstado({ itens: [], loading: false, error: mensagemErro(err, erroPadraoRef.current) })
    }
  }, [incluirArquivados])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    itens: estado.itens,
    loading: estado.loading,
    error: estado.error,
    incluirArquivados,
    setIncluirArquivados,
    refetch
  }
}
