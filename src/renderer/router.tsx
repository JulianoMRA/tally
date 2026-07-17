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
    children: [
      { index: true, element: <Navigate to="/mensal" replace /> },
      { path: 'mensal', element: <VisaoMensalPage /> },
      { path: 'cartoes', element: <CartoesPage /> },
      { path: 'categorias', element: <CategoriasPage /> },
      { path: 'saidas', element: <SaidasPage /> },
      { path: 'faturas', element: <FaturasPage /> },
      { path: 'rendas', element: <RendasPage /> },
      { path: 'ajustes', element: <AjustesPage /> },
      { path: 'importar', element: <ImportarPage /> },
      { path: 'despesas', element: <Navigate to="/saidas" replace /> },
      { path: 'gastos', element: <Navigate to="/saidas" replace /> },
      { path: 'assinaturas', element: <Navigate to="/saidas" replace /> },
      { path: 'relatorios', element: <Navigate to="/mensal" replace /> },
      { path: 'recebimentos', element: <Navigate to="/rendas" replace /> }
    ]
  }
])
