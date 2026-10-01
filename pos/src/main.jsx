import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CajaProvider } from './context/CajaContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App.jsx'
import './index.css'
import './i18n'
import { offlineHabilitado } from './offline/estado'
import { iniciarOffline } from './offline/sync'

// Modo offline (app de escritorio): la app se guarda en el equipo para abrir
// sin internet, y la copia de datos y la cola de ventas se mantienen solas
if (offlineHabilitado()) {
  iniciarOffline()
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CajaProvider>
            <App />
          </CajaProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)