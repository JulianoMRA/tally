import { createHashRouter, Navigate } from 'react-router-dom'
import App from './App'
import CartoesPage from './features/cartoes/CartoesPage'
import CategoriasPage from './features/categorias/CategoriasPage'
import DespesasPage from './features/despesas/DespesasPage'
import FaturasPage from './features/faturas/FaturasPage'
import AssinaturasPage from './features/assinaturas/AssinaturasPage'
import GastosPage from './features/gastos/GastosPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/despesas" replace /> },
      { path: 'cartoes', element: <CartoesPage /> },
      { path: 'categorias', element: <CategoriasPage /> },
      { path: 'despesas', element: <DespesasPage /> },
      { path: 'faturas', element: <FaturasPage /> },
      { path: 'assinaturas', element: <AssinaturasPage /> },
      { path: 'gastos', element: <GastosPage /> }
    ]
  }
])
