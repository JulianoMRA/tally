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

## Fora de escopo

- Engenharia social, phishing usando o nome Tally
- Vulnerabilidades em dependências sem PoC explorável neste app
- Comportamento "by design" documentado no PRD
