import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from './lib/appToast'
import App from './App.tsx'
import { ThemeProvider } from './ThemeContext.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
      <Toaster
        position="bottom-right"
        gutter={10}
        toastOptions={{
          duration: 3500,
          className: 'ujverse-toast',
          style: {
            borderRadius: '1rem',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: 500,
            maxWidth: 'min(90vw, 360px)',
          },
          success: {
            iconTheme: { primary: '#c9a227', secondary: 'rgb(255 255 255 / 0.08)' },
          },
          error: {
            iconTheme: { primary: 'rgb(148 163 184)', secondary: 'rgb(255 255 255 / 0.06)' },
          },
        }}
      />
    </ThemeProvider>
  </React.StrictMode>,
)