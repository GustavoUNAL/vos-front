import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NavigationProvider } from './NavigationContext'
import './index.css'
import './styles/vos-ui.css'
import './styles/entity-actions.css'
import './styles/mobile-views.css'
import './styles/desktop-views.css'
import './styles/landing-mobile.css'
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
