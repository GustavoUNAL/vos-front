import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import type { PosOrder, PosScreen, PosTable } from '../types'
import type { PosWsStatus } from '../services/websocket'

export type PosState = {
  tables: PosTable[]
  tablesLoading: boolean
  tablesError: string | null
  activeOrder: PosOrder | null
  orderLoading: boolean
  orderError: string | null
  screen: PosScreen
  selectedTableId: string | null
  wsStatus: PosWsStatus
  offline: boolean
  demoMode: boolean
}

type PosAction =
  | { type: 'SET_TABLES'; tables: PosTable[] }
  | { type: 'SET_TABLES_LOADING'; loading: boolean }
  | { type: 'SET_TABLES_ERROR'; error: string | null }
  | { type: 'SET_ORDER'; order: PosOrder | null }
  | { type: 'SET_ORDER_LOADING'; loading: boolean }
  | { type: 'SET_ORDER_ERROR'; error: string | null }
  | { type: 'SET_SCREEN'; screen: PosScreen }
  | { type: 'SELECT_TABLE'; tableId: string | null }
  | { type: 'SET_WS_STATUS'; status: PosWsStatus }
  | { type: 'SET_OFFLINE'; offline: boolean }
  | { type: 'SET_DEMO_MODE'; demo: boolean }

const initialState: PosState = {
  tables: [],
  tablesLoading: true,
  tablesError: null,
  activeOrder: null,
  orderLoading: false,
  orderError: null,
  screen: 'tables',
  selectedTableId: null,
  wsStatus: 'idle',
  offline: !navigator.onLine,
  demoMode: false,
}

function reducer(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case 'SET_TABLES':
      return { ...state, tables: action.tables, tablesError: null }
    case 'SET_TABLES_LOADING':
      return { ...state, tablesLoading: action.loading }
    case 'SET_TABLES_ERROR':
      return { ...state, tablesError: action.error }
    case 'SET_ORDER':
      return { ...state, activeOrder: action.order, orderError: null }
    case 'SET_ORDER_LOADING':
      return { ...state, orderLoading: action.loading }
    case 'SET_ORDER_ERROR':
      return { ...state, orderError: action.error }
    case 'SET_SCREEN':
      return { ...state, screen: action.screen }
    case 'SELECT_TABLE':
      return { ...state, selectedTableId: action.tableId }
    case 'SET_WS_STATUS':
      return { ...state, wsStatus: action.status }
    case 'SET_OFFLINE':
      return { ...state, offline: action.offline }
    case 'SET_DEMO_MODE':
      return { ...state, demoMode: action.demo }
    default:
      return state
  }
}

type PosStoreContextValue = {
  state: PosState
  dispatch: React.Dispatch<PosAction>
  setTables: (tables: PosTable[]) => void
  setActiveOrder: (order: PosOrder | null) => void
  navigate: (screen: PosScreen, tableId?: string | null) => void
}

const PosStoreContext = createContext<PosStoreContextValue | null>(null)

export function PosStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setTables = useCallback((tables: PosTable[]) => {
    dispatch({ type: 'SET_TABLES', tables })
  }, [])

  const setActiveOrder = useCallback((order: PosOrder | null) => {
    dispatch({ type: 'SET_ORDER', order })
  }, [])

  const navigate = useCallback(
    (screen: PosScreen, tableId?: string | null) => {
      dispatch({ type: 'SET_SCREEN', screen })
      dispatch({ type: 'SELECT_TABLE', tableId: tableId ?? null })
    },
    [],
  )

  const value = useMemo(
    (): PosStoreContextValue => ({
      state,
      dispatch,
      setTables,
      setActiveOrder,
      navigate,
    }),
    [state, setTables, setActiveOrder, navigate],
  )

  return (
    <PosStoreContext.Provider value={value}>{children}</PosStoreContext.Provider>
  )
}

export function usePosStore(): PosStoreContextValue {
  const ctx = useContext(PosStoreContext)
  if (!ctx) throw new Error('usePosStore requiere PosStoreProvider')
  return ctx
}
