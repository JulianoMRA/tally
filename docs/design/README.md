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

### Proposta de refactor visual (ago/2026)

Em `docs/design/referencia/proposta-2026-08/`. Auditoria de interface sobre
`src/renderer`, com diagnóstico de 17 pontos e painéis antes/depois de seis
telas. O plano de execução está em `docs/design/PLANO-REFACTOR-UI.md`.

| Arquivo               | Conteúdo                                               |
| --------------------- | ------------------------------------------------------ |
| `proposta-ui.dc.html` | A proposta: princípios, diagnóstico, antes/depois      |
| `tally-atual.dc.html` | Recriação da UI atual, usada como painel "antes"       |
| `mapa-telas.md`       | Mapa tela → arquivos de origem, sincronizado em 15/08  |
| `support.js`          | Runtime do renderizador — sem ele os HTML abrem vazios |

Os dois `.dc.html` puxam Geist do Google Fonts. Vale só para eles: o app carrega
as fontes localmente via `@fontsource`, sem CDN.

## Tokens (`src/renderer/styles/tokens.css`)

Dois temas: **Cream** (`:root`, padrão, tom papel quente) e **Papel noturno**
(`[data-theme="escuro"]`, marrom escuro com tinta creme e marca em bronze).

O escuro foi escolhido entre três paletas medidas — Forest (verde-quase-preto,
retomando o `[data-theme="forest"]` esboçado no Slice 4.5 e removido em
`3e2e133`), Papel noturno e Grafite neutro. Venceu a única que mantém o calor do
creme na outra ponta da escala.

**Regra da casa:** componente nenhum declara cor dentro de um seletor de tema. O
`:root` define a paleta clara inteira, o bloco do escuro redefine **apenas
valores**, e todo CSS de feature consome `var()`. Cor cuja única definição
estivesse atrás de `[data-theme]` não existiria no tema claro.

A paleta clara responde a `:root` **e** a `[data-theme="claro"]`. O segundo
seletor não é redundante: ele permite fixar o tema claro numa subárvore, e é o
que torna a folha de impressão imune ao tema (ver `PrintMensalPage`).

```css
--bg          /* fundo base */
--bg-elev     /* cards e painéis elevados */
--bg-sunk     /* sidebar, table headers */
--ink         /* texto principal */
--ink-2/3/4   /* texto secundário/terciário/mudo */
--rule        /* hairlines */
--rule-strong /* divisor de maior contraste */
--brand       /* superfície e sinal de interação: botão primário, item ativo
                 da sidebar, opção ativa do segmented, borda de foco,
                 accent-color. No escuro é bronze */
--brand-2     /* hover de --brand */
--on-brand    /* texto sobre --brand */
--forest      /* fundo do hero da visão mensal, e nada mais */
--bronze      /* destaque quente, positivo */
--income / --expense / --pending / --paid   /* texto e ícone semânticos */
--income-bg / --income-border               /* superfície de badge e banner */
--pending-bg / --pending-border
--expense-bg / --expense-border
--closed / --closed-bg / --closed-border    /* roxo de Fechada e Projeção */
--overlay     /* véu dos modais */
--focus-halo / --error-halo   /* halos de 3px de Input e Select */
--font-sans / --font-mono
--r-1..4 / --r-pill  /* border-radius */
--shadow-1/2
```

**`--forest` já fez três trabalhos e foi dividido.** Valia `#0f1a14`, o mesmo
hex de `--ink`, e servia a superfície de controle, ao bloco do hero e a tinta
forte de texto — três papéis que colidem no mesmo valor no claro e divergem no
escuro. Hoje: superfície é `--brand`, texto é `--ink`, e `--forest` ficou só com
o hero. Se você for usar `--forest` para outra coisa, provavelmente quer
`--brand`.

**O hero inverte de papel entre os temas.** No claro é o bloco mais escuro da
tela (15:1 contra o creme); no escuro é o mais **claro** (1,42:1 contra o
fundo — mais separação do que qualquer card tem em qualquer tema). Escuro sobre
escuro não reproduz o contraste do claro, e foi por isso que `--forest` teve de
sair de `--brand`: assim as três fatias da barra de composição, calibradas para
fundo escuro, valem nos dois temas sem mudar de valor.

Quatro guards em `src/renderer/styles/__tests__/` protegem a paleta:

| Guard               | Falha quando                                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tokens-definidos`  | algum `var(--x)` sem fallback não está em `tokens.css`                                                                      |
| `cores-tokenizadas` | volta hex hardcoded no CSS de alguma feature                                                                                |
| `tipo-tokenizado`   | volta tamanho de fonte solto                                                                                                |
| `contraste`         | um par texto/superfície reprova no WCAG AA **em qualquer tema**, ou um token de cor do claro fica sem contraparte no escuro |

O guard de contraste cobre um buraco que o axe tem por construção: o axe só vê o
que está montado na tela, e três defeitos de contraste já passaram por ali —
`--ink-3`, `--pending` e `--paid`. O último ficou escondido mais tempo porque o
badge "Paga" exige uma fatura fechada **e** paga, que o seed nunca criava. Ver
`e2e/fixtures/ciclo-de-vida.ts`.

## Componentes

### Brand

- `Mark` — logo SVG tipado (variantes: `primary | tally | stack | monogram`)
- `Wordmark` — texto "Tally" estilizado

### Layout

- `Sidebar` — nav lateral 208px com grupos, avatar no rodapé; a versão exibida vem do
  `package.json` via `define` do Vite (`__APP_VERSION__`), não hardcoded
- `TitleBar` — **a única faixa de cromo acima do conteúdo**, 32px em `--bg-sunk`. Carrega o menu do
  aplicativo (que abre da própria marca), o `h1` da página, o alternador de tema e os controles de
  janela. Fica acima do shell inteiro, sidebar inclusive: é moldura da janela, não conteúdo.
  - **O `h1` da página vive aqui**, alimentado por `handle.titulo` da rota em `router.tsx`. Quem
    impede rota e página de divergirem é `titulos-de-rota.test.ts`, e não um aviso em runtime: ler a
    rota do `PageHead` obrigaria toda página a ser testada dentro de um roteador.
  - **Os controles de janela são do app**, não do Windows — daí o rótulo acessível, o foco por
    teclado e o estado de maximizada ouvido do main. Em Linux não são renderizados: lá a moldura
    nativa permanece, e desenhar os nossos deixaria dois conjuntos.
  - **A altura vive em dois lugares** que precisam concordar: `.barra` em `title-bar.module.css` e o
    `calc(100vh - 32px)` do `.shell` em `app.module.css`.
- `PageHead` — linha de apoio da página: **subtítulo à esquerda, ações à direita**. Não renderiza
  heading; se não receber subtítulo nem ações, não renderiza nada. A prop `title` continua na API
  porque as oito telas a passam e ela documenta, no arquivo da própria página, de quem é aquele
  cabeçalho.
  - **Consequência assumida:** as ações da página não acompanham mais a rolagem. O título, sim —
    está na janela agora, sempre visível.
- `PageContainer` — **único lugar que limita a largura de uma página**, e é **uma largura para todas
  as telas** (`--page-max`). Expõe `data-page` para asserção em teste e E2E — o vitest roda com
  `css: false`, então classe de CSS Module vira string vazia e não serve de asserção. Nenhum CSS de
  feature deve declarar `max-width` de página.
  - **Eram três tiers** (`narrow` 760, `default` 1200, `wide` 1760) e um par trilho/bloco cuja única
    razão de existir era impedir que tiers diferentes fizessem cada rota começar num x diferente. A
    medição mostrou que na janela real dois dos três clipavam no mesmo lugar. Com uma largura só o
    problema some por construção e o par vira cerimônia. A borda esquerda comum segue travada por
    `e2e/alinhamento-paginas.spec.ts`, agora medindo `[data-page]`.
  - **O `padding-top` de 24px não é decorativo:** o `Topbar` fixo trazia o próprio respiro, e sem ele
    a primeira linha da página encostava na régua da barra de título.
- A área rolável do `App` usa `scrollbar-gutter: stable`. Sem isso, telas que rolam ficam ~8px mais
  estreitas que as que não rolam e o conteúdo desloca metade disso.

> **O `Topbar` não existe mais.** Era uma segunda faixa de 56px logo abaixo da barra de título,
> com o `h1` e as ações. Removido na v1.8.0: as duas faixas viraram uma, devolvendo ~56px de altura
> útil a todas as telas.

**Breakpoints — atenção ao número real.** A janela padrão do app (`width: 1280` em
`createWindow`) é o tamanho **externo**: a viewport resultante é **1266px**. Um
`@media (min-width: 1280px)` não dispara para quem não maximiza. Larguras medidas:
`setSize(1024) → 1010`, `(1280) → 1266`, `(1440) → 1426`, `(1760) → 1746`. Em uso hoje, três:
**1180** na Visão mensal (duas colunas já na janela padrão), **1360** e **1440** em Faturas.

### UI Primitives (`src/renderer/components/ui/`)

- `Button` — variantes: `primary | secondary | ghost | danger`; tamanhos: `sm | md`
- `Card` — `bg-elev`, raio 12px, `shadow-1`; padding: `none | sm | md`
- `Panel` — container com cabeçalho (`title` + `meta` + `actions`) e corpo (`flush` opcional)
- `Badge` — semânticos: `open | closed | paid | pending | income | expense | active | archived | projection`
- `Input` — input estilizado com estado de erro e focus ring
- `Select` — select com chevron SVG customizado
- `Field` — wrapper label + children + hint/erro
- `SeletorMes` — campo de mês (`type="month"`) com as setas de mês anterior e próximo. Era o mesmo
  bloco repetido em Visão mensal e Saídas; hoje serve as três telas que navegam por mês. **Faturas
  fica de fora de propósito:** lá a navegação é por trilho de cartão, não por mês.
  - **Passe `label` só fora de um `Field`.** Dentro dele quem nomeia é o rótulo visível, e um
    `aria-label` aqui o sobrescreveria.
  - **Campo esvaziado devolve `''`**, e a tela consultaria um mês inexistente. A guarda está no
    `onChange` — só uma das duas cópias originais a tinha.
- `EmptyState` — estado vazio centralizado com título, descrição e ação opcional
- `Modal` — diálogo centrado para **interação curta e focada**: confirmar uma data, ajustar um
  valor, editar metadado. Absorveu o esqueleto que estava copiado em seis modais de feature —
  overlay, armadilha de foco, Esc, `role`/`aria` e a linha de ações — mais o CSS duplicado em quatro
  módulos. Quem controla a abertura é o pai, renderizando ou não o componente: **não há prop
  `aberto`**, e montar só quando visível garante formulário limpo e foco entrando de fato.
  - **O padrão é NÃO fechar no clique do overlay**, ao contrário do `SidePanel`. Todo modal do app
    carrega dado digitado, e descartá-lo por um clique fora foi defeito real (#103). Ligue
    `fecharNoOverlay` só onde não houver o que perder.
  - **Os botões vão na prop `rodape`**, não no `children`. É a pegadinha de quem migra um modal
    antigo.
  - **`descricao` é `ReactNode`**, não `string` como no `SidePanel`: parte dos modais destaca um
    trecho dentro da linha de apoio.
  - **Divisão de trabalho:** `SidePanel` é a casa do cadastro, que é episódio longo e ocupa a
    lateral inteira. `Modal` é o episódio curto.
- `ConfirmDialog` — confirmação modal de ação destrutiva (Slice 14). **Não é construído sobre o
  `Modal`**, por decisão tomada quando o primitivo nasceu; vale reavaliar agora que o `Modal` roda
  em seis telas
- `Table` — tabela do design system; densidades `padrao | compacta`. O estilo estava duplicado
  **byte a byte** entre `faturas` e `visao-mensal` — dez declarações idênticas só no `th`.
  `compacta` é o degrau que Saídas adotou na v1.5.1: num mês com 15 parceladas recupera mais de uma
  tela de rolagem.
  - **Duas tabelas ficam fora de propósito:** `print-mensal.module.css`, que é folha de impressão
    com medidas em px e escala própria, e a `.tabelaErros` de Importar, que é diagnóstico e não
    dado da aplicação.
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
- `SidePanel` — painel lateral sobreposto para cadastro sob demanda, com `useFocusTrap` e
  `useEscapeKey` (mesmo par do `ConfirmDialog`). Quem controla a abertura é o pai,
  renderizando ou não o componente: montar só quando visível garante formulário limpo a
  cada abertura e foco entrando de fato. Cabeçalho e rodapé são fixos e só o corpo rola —
  o rodapé carrega o botão de salvar e não pode sair de vista. `fecharNoOverlay={false}`
  para formulário com dado digitado, pelo mesmo motivo que o `ConfirmDialog` trava o
  overlay em ação destrutiva. **Sempre overlay, nunca coluna**: a proposta desenhou 440px
  ao lado da lista, mas isso pressupõe os 1906px do mockup — na janela padrão sobrariam
  618px para a tabela de Saídas, menos que os ~698px que ela precisa
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
