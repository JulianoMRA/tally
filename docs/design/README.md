# Tally — Design System

Design system implementado no Slice 4.5. Referência para todos os slices seguintes.

## Arquivos de referência

| Arquivo                        | Conteúdo                                            |
| ------------------------------ | --------------------------------------------------- |
| `TallyDesign/tokens.css`       | Paleta original, tipografia, raios, shadows         |
| `TallyDesign/Tally Brand.html` | Brand book completo com exemplos de uso da marca    |
| `TallyDesign/Tally App.html`   | Protótipo da tela inicial (visão mensal — Slice 11) |
| `TallyDesign/marks.js`         | Fonte dos SVGs do logo                              |

## Tokens (`src/renderer/styles/tokens.css`)

Dois temas definidos via CSS custom properties:

- **Cream** (`:root`) — padrão atual, tom papel quente
- **Forest** (`[data-theme="forest"]`) — dark mode, ativado no Slice 14

Variáveis principais:

```css
--bg          /* fundo base */
--bg-elev     /* cards e painéis elevados */
--bg-sunk     /* sidebar, table headers */
--ink         /* texto principal */
--ink-2/3/4   /* texto secundário/terciário/mudo */
--rule        /* hairlines */
--forest      /* brand verde escuro (também fundo de item ativo) */
--sage        /* verde secundário */
--bronze      /* destaque quente, positivo */
--income / --expense / --pending / --paid  /* semânticas */
--font-sans / --font-mono
--r-1..4 / --r-pill  /* border-radius */
--shadow-1/2
```

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
- `Badge` — badges semânticos: `open | closed | paid | pending | income | expense | active | archived`
- `Input` — input estilizado com estado de erro e focus ring
- `Select` — select com chevron SVG customizado
- `Field` — wrapper label + children + hint/erro
- `EmptyState` — estado vazio centralizado com título, descrição e ação opcional

## Fontes

Geist e Geist Mono via `@fontsource` — carregadas localmente, sem CDN.

Pesos importados em `src/renderer/main.tsx`:

- Geist: 400, 500, 600
- Geist Mono: 400, 500
