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
- `window.open` é negado nas duas janelas — a principal e a oculta que gera o
  PDF do mês, que carrega o mesmo preload e portanto tem `window.api` inteiro
- Navegação só é aceita para o mesmo documento que a janela já carrega: só o
  fragmento pode mudar, que é como o `createHashRouter` troca de tela. A
  comparação é protocolo + host + caminho (`electron/navegacao.ts`), **nunca
  por origem** — a de toda URL `file:` é a string `'null'`, então dois arquivos
  diferentes do disco a compartilham — **nem por prefixo**. Janela sem página
  carregada recusa tudo. A janela do PDF cancela qualquer navegação
- URLs http(s) recusadas vão para `shell.openExternal` no navegador do SO, com
  comparação exata de protocolo: `javascript:`, `file:`, `data:` e handlers de
  protocolo do Windows não chegam lá
- IPC tem schemas Zod em todos os canais (defense in depth)
- SQL sempre via statements parametrizados — nenhuma string concatenada
- Restauração de backup só aceita uma cópia que o próprio app lista
  (`resolverBackupRestauravel`). O caminho vem do renderer e vira
  `copyFileSync` por cima do banco; confrontar com `listarBackups` mantém
  uma fonte de verdade só e descarta travessia com `..`, o próprio banco e
  arquivo de nome estranho largado na pasta
- Pasta de backups escolhida pelo usuário é validada como caminho absoluto
  na ESCRITA do settings — não na leitura, porque `lerConfig` cai nos
  defaults quando o arquivo não passa no schema, e recusar um valor já
  gravado apagaria as outras configurações em silêncio
- Export CSV neutraliza injeção de fórmula: célula de texto começando com `=`,
  `+`, `-`, `@`, tab ou CR sai prefixada com apóstrofo. O vetor não exige que o
  usuário digite contra si mesmo — a importação de CSV aceita arquivo de
  terceiro, e o texto volta para o Excel no export do mês
- `npm audit --omit=dev --audit-level=high` roda localmente no pipeline pré-PR
  (o gate de CI que o executava saiu com os workflows em ago/2026). **Verde
  desde ago/2026: `found 0 vulnerabilities`.** Ler a seção "O que o audit mede"
  antes de interpretar um vermelho aqui
- Single-instance lock via `app.requestSingleInstanceLock()`

## O que o audit mede

O gate roda `npm audit --omit=dev`, que reporta a **árvore de dependências de
produção** — não o que vai dentro do instalador. As duas coisas não são a
mesma, e a diferença já custou uma leitura errada.

**Medido em ago/2026** com `npm run dist:dir` seguido de
`npx asar list release/win-unpacked/resources/app.asar`:

- O `app.asar` **contém** as dependências de produção: `node-sqlite3-wasm`,
  `zod`, `electron-updater`, React, recharts — 78 pacotes.
- **`electron`, `undici` e `@electron/get` têm ZERO entradas.** O
  electron-builder exclui o pacote `electron` e a subárvore dele: o runtime vem
  do binário, não do npm.

Ou seja, um high vindo de `electron` aparece no audit e **não** chega à máquina
de quem usa o app. Antes de estimar o custo de um advisory, rode
`npm ls <pacote> --omit=dev` **inteiro** — ele lista todos os caminhos, e ler só
o primeiro leva a concluir que remover uma dependência resolve quando há outra
segurando a mesma subárvore.

**Cuidado ao medir.** `npx asar list` no Windows emite caminhos com
contrabarra; filtrar por `/node_modules/` devolve zero e parece provar que nada
embarca. Normalize antes. E `npm audit ... | tail` devolve o código de saída do
`tail`, não do npm.

## Advisories aceitos

**Nenhum em aberto.** O gate está verde (`found 0 vulnerabilities`).

O último aceito era o `GHSA-qwww-vcr4-c8h2` (React Router RSC Mode CSRF Bypass),
inaplicável aqui porque o modo RSC exige runtime de servidor e o app usa
`createHashRouter` local. **Deixou de ser reportado** quando o `react-router-dom`
subiu para 7.18.2, e a seção saiu em ago/2026 por estar descrevendo um advisory
que o audit não lista mais.

O que fechou o vermelho que restava foi remover `@electron-toolkit/preload` (que
não tinha um único import) e `@electron-toolkit/utils` (usado só pelo `is.dev`,
que é literalmente `!app.isPackaged` — ver `electron/ambiente.ts`). Os dois
declaravam `electron` como dependência de produção, e eram eles que mantinham o
`undici` e seus cinco advisories high na árvore.

**Se um advisory novo aparecer:** registrar aqui com o motivo, e revisar a cada
release. Se a premissa mudar, o advisory volta a valer.

**Nota herdada, ainda válida.** `npm audit fix --force` já sugeriu **downgrade**
do `react-router-dom` para 7.11.0. Não aceitar: reintroduz uma negação de
serviço por route matching ineficiente (high, corrigida na 7.18.0) e três
moderates.

## Fora de escopo

- Engenharia social, phishing usando o nome Tally
- Vulnerabilidades em dependências sem PoC explorável neste app
- Comportamento "by design" documentado no PRD
