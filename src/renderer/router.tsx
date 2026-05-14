import { createHashRouter, Navigate } from 'react-router-dom'
import App from './App'
import CartoesPage from './features/cartoes/CartoesPage'

export const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/cartoes" replace /> },
      { path: 'cartoes', element: <CartoesPage /> }
    ]
  }
])
