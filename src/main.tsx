import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NavigationProvider } from './NavigationContext'
import './index.css'
import './styles/vos-ui.css'
import App from './App.tsx'
import { PublicShopApp } from './shop/PublicShopApp'
import { isPublicShopRoute } from './shop/shopApi'

function RootApp() {
  if (isPublicShopRoute()) {
    return <PublicShopApp />
  }
  return (
    <NavigationProvider>
      <App />
    </NavigationProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
