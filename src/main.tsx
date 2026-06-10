// Architecture : point d'entrée unique — les 4 surfaces sont des groupes de
// routes lazy-loadées (PLAN.md D11) : l'EP ne charge jamais le code du
// backoffice ni de l'IR.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
