import { app } from 'electron'

/**
 * Substitui o `is.dev` do `@electron-toolkit/utils`, que era a única coisa que
 * o projeto usava daquele pacote — e cuja definição é, literalmente,
 * `!electron.app.isPackaged`.
 *
 * O pacote saiu porque declara `electron` como dependência de produção, e era
 * ele que mantinha o `electron` (e o `undici`, com cinco advisories high) na
 * árvore de produção. O binário empacotado nunca teve o problema: `asar list`
 * sobre o `app.asar` mostra zero entradas de `electron`, `undici` e
 * `@electron/get` — o electron-builder exclui essa subárvore, porque o runtime
 * vem do binário e não do npm. O que estava vermelho era o
 * `npm audit --omit=dev`, que mede a árvore de dependências e não o pacote.
 *
 * Um gate cronicamente vermelho ensina a ignorar gate, e este é o único que
 * sobrou depois que a CI saiu, em ago/2026.
 *
 * `app.isPackaged` está disponível antes do `whenReady` e não muda em runtime,
 * então chamar isto a cada uso tem o mesmo resultado que o `is.dev`, que era
 * calculado uma vez, no carregamento do módulo.
 */
export function ehDev(): boolean {
  return !app.isPackaged
}
