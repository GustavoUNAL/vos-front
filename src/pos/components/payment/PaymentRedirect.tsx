import { useEffect } from 'react'
import { usePosStore } from '../../store/posStore'
import { PosLoader } from '../ui/PosLoader'

/** Pantalla de cobro unificada en la comanda; redirige rutas legacy. */
export function PaymentRedirect() {
  const { state, navigate } = usePosStore()

  useEffect(() => {
    navigate('order', state.selectedTableId)
  }, [navigate, state.selectedTableId])

  return <PosLoader label="Abriendo cuenta…" />
}
