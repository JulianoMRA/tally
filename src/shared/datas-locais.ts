/**
 * Datas "hoje" no fuso LOCAL do usuário.
 *
 * Nunca use `new Date().toISOString().slice(0, 10)` para representar "hoje":
 * toISOString é UTC e, em UTC-3, a partir das 21h o dia UTC já virou — faturas
 * fechariam até 3h mais cedo e formulários sugeririam a data de amanhã.
 * Compartilhado entre main process, persistence e renderer.
 */

/** Data local de hoje no formato YYYY-MM-DD. */
export function hojeIsoLocal(): string {
  const agora = new Date()
  const ano = agora.getFullYear().toString().padStart(4, '0')
  const mes = String(agora.getMonth() + 1).padStart(2, '0')
  const dia = String(agora.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Mês de referência local corrente no formato YYYY-MM. */
export function mesAtualReferencia(): string {
  return hojeIsoLocal().slice(0, 7)
}
