import { useEffect, useRef } from 'react'
import { useToast } from '../components/ui'
import { mensagemErro } from '../lib/mensagem-erro'

/**
 * Carga auxiliar na montagem: a lista que alimenta um select ou traduz um id em
 * nome, e que não é o assunto da tela.
 *
 * Existia cinco vezes como `window.api.x.list(...).then(setEstado)`, sem
 * `.catch` em nenhuma delas. Numa falha do IPC a rejeição ficava solta e a
 * lista permanecia vazia **em silêncio** — o select abria sem opções e os nomes
 * caíam no fallback `#id`, sem nada indicar que houve erro. O canal de aviso do
 * app é o toast desde o hardening da v1.0.0, e é ele que este hook usa.
 *
 * Callbacks vivem em ref, e não nas dependências: quem chama passa arrow inline,
 * e nas dependências isso recarregaria a cada render. Mesma lição do
 * `useListaArquivavel`.
 */
export function useCargaAuxiliar<T>(
  carregar: () => Promise<T>,
  aplicar: (dados: T) => void,
  erroPadrao: string
): void {
  const { show } = useToast()
  const carregarRef = useRef(carregar)
  const aplicarRef = useRef(aplicar)
  const erroPadraoRef = useRef(erroPadrao)
  carregarRef.current = carregar
  aplicarRef.current = aplicar
  erroPadraoRef.current = erroPadrao

  useEffect(() => {
    let ativo = true
    carregarRef
      .current()
      .then((dados) => {
        if (ativo) aplicarRef.current(dados)
      })
      .catch((err: unknown) => {
        if (ativo) show(mensagemErro(err, erroPadraoRef.current), 'error')
      })
    return () => {
      ativo = false
    }
  }, [show])
}
