import { lazy, Suspense } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import App from './App'
import { RouteErrorBoundary } from './components/ui/ErrorBoundary'

// Páginas carregadas sob demanda (code splitting por rota). Cada uma vira um
// chunk separado, reduzindo o bundle inicial; o Suspense do App exibe o fallback.
const VisaoMensalPage = lazy(() => import('./features/visao-mensal/VisaoMensalPage'))
const CartoesPage = lazy(() => import('./features/cartoes/CartoesPage'))
const CategoriasPage = lazy(() => import('./features/categorias/CategoriasPage'))
const SaidasPage = lazy(() => import('./features/saidas/SaidasPage'))
const FaturasPage = lazy(() => import('./features/faturas/FaturasPage'))
const RendasPage = lazy(() => import('./features/rendas/RendasPage'))
const SimulacaoPage = lazy(() => import('./features/simulacao/SimulacaoPage'))
const AjustesPage = lazy(() => import('./features/ajustes/AjustesPage'))
const ImportarPage = lazy(() => import('./features/importacao/ImportarPage'))
const PrintMensalPage = lazy(() => import('./features/visao-mensal/PrintMensalPage'))

export const router = createHashRouter([
  // Rota de impressão fora do shell do App (sem sidebar/topbar): usada pela
  // janela oculta do main para gerar o PDF mensal via printToPDF. Suspense
  // próprio porque o fallback do App não a envolve.
  {
    path: '/print/:mes',
    element: (
      <Suspense fallback={null}>
        <PrintMensalPage />
      </Suspense>
    )
  },
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    // `handle.titulo` alimenta o `h1` da barra de título. Os rótulos são
    // exatamente os do `NAV` da `Sidebar`: o par link-de-nav ↔ `h1` é o que o
    // leitor de tela e o helper `irPara` dos E2E usam para confirmar onde a
    // navegação parou, e depende de os dois nomes serem idênticos.
    children: [
      { index: true, element: <Navigate to="/mensal" replace /> },
      { path: 'mensal', element: <VisaoMensalPage />, handle: { titulo: 'Visão mensal' } },
      { path: 'cartoes', element: <CartoesPage />, handle: { titulo: 'Cartões' } },
      { path: 'categorias', element: <CategoriasPage />, handle: { titulo: 'Categorias' } },
      { path: 'saidas', element: <SaidasPage />, handle: { titulo: 'Saídas' } },
      { path: 'faturas', element: <FaturasPage />, handle: { titulo: 'Faturas' } },
      { path: 'rendas', element: <RendasPage />, handle: { titulo: 'Rendas' } },
      { path: 'simulacao', element: <SimulacaoPage />, handle: { titulo: 'Simulação' } },
      { path: 'ajustes', element: <AjustesPage />, handle: { titulo: 'Ajustes' } },
      { path: 'importar', element: <ImportarPage />, handle: { titulo: 'Importar dados' } },
      { path: 'despesas', element: <Navigate to="/saidas" replace /> },
      { path: 'gastos', element: <Navigate to="/saidas" replace /> },
      { path: 'assinaturas', element: <Navigate to="/saidas" replace /> },
      { path: 'relatorios', element: <Navigate to="/mensal" replace /> },
      { path: 'recebimentos', element: <Navigate to="/rendas" replace /> }
    ]
  }
])
