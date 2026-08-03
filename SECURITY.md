# Security Policy

Tally é uma app desktop pessoal sem componentes de rede. O banco SQLite vive
localmente e nenhum dado sai da máquina. Mesmo assim, vulnerabilidades de
software podem afetar usuários.

## Versões suportadas

Apenas a última release publicada em [GitHub Releases](https://github.com/JulianoMRA/tally/releases).
Releases anteriores não recebem patches.

## Reportar uma vulnerabilidade

Se você encontrar uma vulnerabilidade, **não abra issue pública**. Reporte
via [GitHub Security Advisories privados](https://github.com/JulianoMRA/tally/security/advisories/new)
ou e-mail para `julianomra.jm@gmail.com` com:

- Descrição clara do problema
- Passos para reproduzir
- Impacto estimado
- Versão afetada (`tally --version` ou nome do `.exe` instalado)
- Sua sugestão de fix, se houver

Resposta esperada em até **7 dias**. Como é projeto pessoal, sem SLA formal —
mas trato segurança com prioridade.

## Threat model

Tally executa como app Electron empacotada via NSIS/portable, sem componente
de rede e sem código remoto:

- Renderer roda com `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: true`, `webSecurity: true`
- CSP estrita (`default-src 'self'`): em produção injetada como meta tag no
  HTML durante o build (plugin `tally-csp-meta` em `electron.vite.config.ts`);
  em dev aplicada via `session.webRequest.onHeadersReceived` (com as exceções
  que o HMR do Vite exige)
- Fuses do Electron no binário empacotado: `runAsNode`, `NODE_OPTIONS` e
  argumentos de inspect desabilitados; app carrega somente do asar
  (`onlyLoadAppFromAsar`)
- `window.open` é negado; navegação interna fica presa ao renderer; URLs
  http(s) são abertas via `shell.openExternal` no navegador do SO
- IPC tem schemas Zod em todos os canais (defense in depth)
- SQL sempre via statements parametrizados — nenhuma string concatenada
- `npm audit --omit=dev --audit-level=high` roda localmente no pipeline pré-PR
  (o gate de CI que o executava saiu com os workflows em ago/2026)
- Single-instance lock via `app.requestSingleInstanceLock()`

## Advisories aceitos

Advisories que o `npm audit` reporta e que foram avaliados e **aceitos**, com o
motivo. Revisar a cada release: se a premissa mudar, o advisory volta a valer.

### GHSA-qwww-vcr4-c8h2 — React Router RSC Mode CSRF Bypass (high)

**Status:** aceito. Afeta `react-router` de 7.12.0 a 8.2.0; a correção está na
8.3.0.

**Por que não corrigimos.** O advisory é específico do **modo RSC** (React
Server Components), que exige um runtime de servidor executando actions. Tally
não tem servidor: é Electron local, o roteamento usa `createHashRouter`
(`src/renderer/router.tsx`) e não há SSR, RSC, loaders remotos nem actions. A
condição necessária para explorar não existe neste app.

**Por que não subimos mesmo assim.** Não é bump de versão. O `react-router-dom`
foi descontinuado na 7.18.2 e consolidado no pacote `react-router`, e o v8 exige
`react >= 19.2.7` e `node >= 22.22.0`. Corrigir um advisory inaplicável custaria
uma migração tripla — troca de pacote, React 18 → 19 com todo o ecossistema
junto, e subir o piso de Node do projeto — com risco de regressão real em troca
de risco de segurança nulo.

**O que foi feito.** `react-router-dom` subiu para 7.18.2 (ago/2026), o que
eliminou os outros quatro advisories da mesma dependência, incluindo o único
com aplicabilidade real aqui: negação de serviço por route matching ineficiente
(high, corrigido na 7.18.0).

**Nota para quem rodar o audit.** `npm audit fix --force` sugere **downgrade**
para 7.11.0. Não aceitar: reintroduz o DoS e os três moderates.

## Fora de escopo

- Engenharia social, phishing usando o nome Tally
- Vulnerabilidades em dependências sem PoC explorável neste app
- Comportamento "by design" documentado no PRD
