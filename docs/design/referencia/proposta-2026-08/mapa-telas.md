repo: JulianoMRA/tally
branch: main
path: src/renderer

## Last sync

date: 2026-08-15T19:52:00Z

### Updated in this project

- Recriada a UI atual do app (9 telas) como referência "antes" em TallyAtual.dc.html
- Auditoria de 17 pontos de hierarquia, densidade e fluxo
- Proposta antes/depois para Visão mensal, Saídas, Faturas, Rendas e o padrão Cartões/Categorias
- Escala de tipo (6 degraus), largura única e regras de peso propostas para os tokens

## Screen map

| Tela                                  | Arquivos de origem                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell (sidebar, page head, container) | src/renderer/App.tsx, components/layout/\*, styles/tokens.css, styles/global.css                                                                            |
| Visão mensal                          | features/visao-mensal/VisaoMensalPage.tsx, SaldoCard.tsx, FaturasCardCompacto.tsx, features/relatorios/PaineisRelatorios.tsx, components/OrcamentoPanel.tsx |
| Faturas (lista)                       | features/faturas/FaturasPage.tsx, FaturasOverview.tsx, status-variant.ts, aviso-fechamento.ts                                                               |
| Fatura (detalhe)                      | features/faturas/FaturaDetalhe.tsx                                                                                                                          |
| Saídas                                | features/saidas/SaidasPage.tsx, features/despesas/DespesaForm.tsx                                                                                           |
| Rendas                                | features/rendas/RendasPage.tsx, RendaForm.tsx, RendaList.tsx                                                                                                |
| Cartões                               | features/cartoes/CartoesPage.tsx, CartaoForm.tsx, CartaoList.tsx                                                                                            |
| Categorias                            | features/categorias/CategoriasPage.tsx, CategoriaForm.tsx, CategoriaList.tsx                                                                                |
| Importar dados                        | features/importacao/ImportarPage.tsx                                                                                                                        |
| Ajustes                               | features/ajustes/AjustesPage.tsx                                                                                                                            |
| Componentes UI                        | components/ui/{Button,Panel,Badge,Field,Input,Select,SegmentedControl,RowActions,SortableHeader,EmptyState,ColorPicker}.tsx + módulos CSS                   |
