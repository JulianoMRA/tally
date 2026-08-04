# Tally — Design System

Design system implementado no Slice 4.5. Referência para todos os slices seguintes.

## Arquivos de referência

Material original do Slice 4.5, em `docs/design/referencia/`. É registro de
como a marca foi desenhada — **não** é a fonte de verdade do que está no app.

| Arquivo                    | Conteúdo                                            |
| -------------------------- | --------------------------------------------------- |
| `brand-book.html`          | Manual de marca completo com exemplos de uso        |
| `mockup-visao-mensal.html` | Protótipo da tela inicial (visão mensal — Slice 11) |
| `marks.js`                 | Fonte dos SVGs do logo                              |
| `tokens-slice-4-5.css`     | Snapshot da paleta original, só para os HTML acima  |

Abra os HTML direto no navegador (`file://`). O `tokens-slice-4-5.css` existe
apenas para eles renderizarem como foram desenhados em mai/2026 e já divergiu da
paleta viva — o cabeçalho do arquivo lista as diferenças. Mudança de paleta vai
em `src/renderer/styles/tokens.css`, nunca ali.

## Tokens (`src/renderer/styles/tokens.css`)

Tema único: **Cream** (`:root`), tom papel quente. Um tema escuro chegou a ser
esboçado como `[data-theme="forest"]`, mas o switcher nunca foi implementado e
os overrides mortos foram removidos; se o dark mode for priorizado, volta junto
com o switcher.

```css
--bg          /* fundo base */
--bg-elev     /* cards e painéis elevados */
--bg-sunk     /* sidebar, table headers */
--ink         /* texto principal */
--ink-2/3/4   /* texto secundário/terciário/mudo */
--rule        /* hairlines */
--rule-strong /* divisor de maior contraste */
--forest      /* brand verde escuro (também fundo de item ativo) */
--sage        /* verde secundário */
--bronze      /* destaque quente, positivo */
--income / --expense / --pending / --paid   /* texto e ícone semânticos */
--income-bg / --income-border               /* superfície de badge e banner */
--pending-bg / --pending-border
--expense-bg / --expense-border
--closed / --closed-bg / --closed-border    /* roxo de Fechada e Projeção */
--font-sans / --font-mono
--r-1..4 / --r-pill  /* border-radius */
--shadow-1/2
```

Dois guards em `src/renderer/styles/__tests__/` protegem a paleta: um falha se
algum `var(--x)` sem fallback não estiver definido em `tokens.css`, o outro se
voltar hex hardcoded no CSS de alguma feature.

## Componentes

### Brand

- `Mark` — logo SVG tipado (variantes: `primary | tally | stack | monogram`)
- `Wordmark` — texto "Tally" estilizado

### Layout

- `Sidebar` — nav lateral 208px com grupos, avatar no rodapé; a versão exibida vem do
  `package.json` via `define` do Vite (`__APP_VERSION__`), não hardcoded
- `Topbar` — barra fixa no topo da área rolável com o título da página e slot de ações.
  Consumido pelo `PageHead`, que segue sendo a API das páginas
- `PageHead` — compõe o `Topbar` (título + ações, fixos) e o subtítulo, que rola junto com o
  conteúdo: grudar as três linhas custaria ~90px fixos numa janela de 800px
- `PageContainer` — **único lugar que limita a largura de uma página**. Envolve o `PageHead` e o
  conteúdo, centraliza e aplica o padding lateral. Larguras: `narrow` (760px, formulário único —
  Ajustes e Importar), `default` (1200px, o caso comum) e `wide` (1760px, telas densas — Visão
  mensal e Saídas), dos tokens `--page-max-*`. Expõe `data-width` para asserção em teste e E2E.
  Nenhum CSS de feature deve declarar `max-width` de página.

**Breakpoints — atenção ao número real.** A janela padrão do app (`width: 1280` em
`createWindow`) é o tamanho **externo**: a viewport resultante é **1266px**. Um
`@media (min-width: 1280px)` não dispara para quem não maximiza. Larguras medidas:
`setSize(1024) → 1010`, `(1280) → 1266`, `(1440) → 1426`, `(1760) → 1746`. Em uso hoje:
1180 na Visão mensal (duas colunas já na janela padrão) e 1400 em Saídas (abaixo disso a
tabela fica mais estreita ao lado do formulário do que ocupando a largura inteira).

### UI Primitives (`src/renderer/components/ui/`)

- `Button` — variantes: `primary | secondary | ghost | danger`; tamanhos: `sm | md`
- `Card` — `bg-elev`, raio 12px, `shadow-1`; padding: `none | sm | md`
- `Panel` — container com cabeçalho (`title` + `meta` + `actions`) e corpo (`flush` opcional)
- `Badge` — semânticos: `open | closed | paid | pending | income | expense | active | archived | projection`
- `Input` — input estilizado com estado de erro e focus ring
- `Select` — select com chevron SVG customizado
- `Field` — wrapper label + children + hint/erro
- `EmptyState` — estado vazio centralizado com título, descrição e ação opcional
- `ConfirmDialog` — confirmação modal de ação destrutiva (Slice 14)
- `SortableHeader` — cabeçalho de coluna ordenável: `<button>` interno (Enter e Espaço de
  graça) e `aria-sort` na célula. Antes era `<th onClick>` sem role, tabIndex nem teclado —
  ordenar era exclusivo de mouse, e o axe não pegava porque `<th>` clicável não viola regra
- `SegmentedControl` — escolha única em pílula, com `radiogroup`/`radio` (padrão) ou
  `tablist`/`tab` quando troca o conteúdo da tela. Setas, Home/End e roving tabindex.
  **Substituiu sete implementações** quase idênticas espalhadas pelas features
- `ColorPicker` — swatches da paleta de sugestão + entrada livre. `COR_PADRAO` é o default
  dos formulários, no lugar do `#000000` do input nativo. As cores vivem em TS, não em CSS,
  porque são dado gravado no banco — e assim o guard `cores-tokenizadas` segue satisfeito
- `FileDropzone` — área de upload com arrastar-e-soltar. O `<input type="file">` continua no
  DOM, transparente sobre a zona: mantém semântica, teclado e o `setInputFiles` do Playwright
- `RowActions` — ações de uma linha de tabela/lista: as primeiras `visiveis` viram botões e o
  resto entra num menu "⋯" (setas, Home/End, Esc, foco devolvido ao gatilho). **Ação marcada
  como `destrutiva` nunca vira botão solto na linha**, nem sendo a única. O menu é renderizado
  num portal em `document.body` — containers de tabela com `overflow-x: auto` recortariam um
  menu posicionado dentro deles — e inverte para cima quando não cabe abaixo do gatilho. O
  `contexto` da linha rotula o **menu**, não o gatilho: `aria-label` de descendente entra no
  nome acessível da célula, e a descrição ali dentro colidia com a célula de descrição.
- `ToastProvider` — feedback de sucesso e erro das mutações (Slice 14)
- `ErrorBoundary` — captura de erro de render com tela de recuperação

Hooks auxiliares (`src/renderer/hooks/`): `useEscapeKey` fecha modal com Esc;
`useFocusTrap` leva o foco para dentro do modal ao abrir, cicla o Tab e devolve o foco ao
gatilho ao fechar — sem ele o `ConfirmDialog` abria com o foco ainda na linha de trás.
Helper `aoTeclarComoBotao` (`lib/teclado.ts`) para elementos com `role="button"`: o padrão
WAI-ARIA exige Enter **e** Espaço.

**Foco visível.** O token `--focus-ring` e a regra `:focus-visible` em `global.css` valem
para tudo que recebe foco por teclado. Antes não existia nenhuma: o app usava o outline
default do Chromium (0,8px laranja) sobre fundo creme.

## Fontes

Geist e Geist Mono via `@fontsource` — carregadas localmente, sem CDN.

Pesos importados em `src/renderer/main.tsx`:

- Geist: 400, 500, 600
- Geist Mono: 400, 500
