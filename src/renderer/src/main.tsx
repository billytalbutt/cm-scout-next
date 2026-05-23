import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ProfileWindowApp } from './profile/ProfileWindowApp'
import { parseProfileWindowRoute } from './profile/profileWindowRoute'

const route = parseProfileWindowRoute(window.location.hash)
const root = document.getElementById('root')!

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {route ? <ProfileWindowApp route={route} /> : <App />}
  </React.StrictMode>,
)
