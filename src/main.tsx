import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.tsx'
import { ThemeProvider } from './ThemeContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            borderRadius: '14px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
            background: '#0f1f38',
            color: '#e2e8f0',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          },
          success: {
            iconTheme: { primary: '#FF9900', secondary: '#0f1f38' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#0f1f38' },
          },
        }}
      />
    </ThemeProvider>
  </React.StrictMode>,
)