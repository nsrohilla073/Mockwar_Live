import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Arena from './Arena.jsx'
import Auth from './Auth.jsx' // <-- नया Auth इम्पोर्ट किया
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<Auth />} /> {/* <-- लॉगिन पेज का पाथ */}
        <Route path="/" element={<App />} />
        <Route path="/arena/:tableId" element={<Arena />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)