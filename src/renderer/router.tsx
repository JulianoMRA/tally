import { createHashRouter, Navigate } from 'react-router-dom'
import App from './App'
import { RouteErrorBoundary } from './components/ui/ErrorBoundary'
import CartoesPage from './features/cartoes/CartoesPage'
import CategoriasPage from './features/categorias/CategoriasPage'
import DespesasPage from './features/despesas/DespesasPage'
import FaturasPage from './features/faturas/FaturasPage'
import AssinaturasPage from './features/assinaturas/AssinaturasPage'
import GastosPage from './features/gastos/GastosPage'
import RelatoriosPage from './features/relatorios/RelatoriosPage'
import RendasPage from './features/rendas/RendasPage'
import VisaoMensalPage from './features/visao-mensal/VisaoMensalPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/mensal" replace /> },
      { path: 'mensal', element: <VisaoMensalPage /> },
      { path: 'cartoes', element: <CartoesPage /> },
      { path: 'categorias', element: <CategoriasPage /> },
      { path: 'despesas', element: <DespesasPage /> },
      { path: 'faturas', element: <FaturasPage /> },
      { path: 'assinaturas', element: <AssinaturasPage /> },
      { path: 'gastos', element: <GastosPage /> },
      { path: 'rendas', element: <RendasPage /> },
      { path: 'relatorios', element: <RelatoriosPage /> },
      { path: 'recebimentos', element: <Navigate to="/rendas" replace /> }
    ]
  }
])
