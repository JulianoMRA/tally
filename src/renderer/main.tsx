import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import '@fontsource/geist/400.css'
import '@fontsource/geist/500.css'
import '@fontsource/geist/600.css'
// 700 e 800 entraram com o refactor visual: o hero da visão mensal e os títulos
// de seção dependem deles. Sem o arquivo importado o Chromium sintetiza o
// negrito — engorda o traço sem trocar de corte, e a hierarquia não aparece.
import '@fontsource/geist/700.css'
import '@fontsource/geist/800.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'
import './styles/tokens.css'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
