import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './optionalHelperFallback'

document.title = import.meta.env.DEV
  ? 'MPTS Watchkeeper - Dev'
  : 'MPTS Watchkeeper'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
