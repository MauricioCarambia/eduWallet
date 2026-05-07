import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { CajaProvider } from './context/CajaContext'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CajaProvider>
          <App />
        </CajaProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)