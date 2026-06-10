// Architecture : routing des 4 surfaces (PLAN.md §2).
//   /screen/:slug   EP — écran public (lecture seule, 1920×1080)
//   /control/:slug  IR — régie/animateur (PIN)
//   /admin          Backoffice de configuration
//   /q/:slug        Formulaire audience (QR code)
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

const ScreenRoute = lazy(() => import('./routes/screen/ScreenRoute'))
const ControlRoute = lazy(() => import('./routes/control/ControlRoute'))
const AdminRoute = lazy(() => import('./routes/admin/AdminRoute'))
const AudienceRoute = lazy(() => import('./routes/audience/AudienceRoute'))

export function App() {
  return (
    <BrowserRouter>
      {/* Fallback neutre : l'EP ne doit jamais montrer d'UI de chargement intrusive */}
      <Suspense fallback={<div className="h-screen w-screen bg-slate-900" />}>
        <Routes>
          <Route path="/screen/:slug" element={<ScreenRoute />} />
          <Route path="/control/:slug" element={<ControlRoute />} />
          <Route path="/admin/*" element={<AdminRoute />} />
          <Route path="/q/:slug" element={<AudienceRoute />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
