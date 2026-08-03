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

- `Sidebar` — nav lateral 232px com grupos, avatar no rodapé
- `Topbar` — header sticky 56px com breadcrumb e slot de ações
- `PageHead` — h1 + subtítulo + slot de ações, padding 28px 32px

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
- `ToastProvider` — feedback de sucesso e erro das mutações (Slice 14)
- `ErrorBoundary` — captura de erro de render com tela de recuperação

Hook auxiliar: `useEscapeKey` (`src/renderer/hooks/use-escape-key.ts`), fecha
modal com Esc.

## Fontes

Geist e Geist Mono via `@fontsource` — carregadas localmente, sem CDN.

Pesos importados em `src/renderer/main.tsx`:

- Geist: 400, 500, 600
- Geist Mono: 400, 500
