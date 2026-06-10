export type MobileModuleIconId =
  | 'home'
  | 'menu'
  | 'products'
  | 'recipes'
  | 'inventory'
  | 'sales'
  | 'pos'
  | 'shop'
  | 'purchases'
  | 'staff'
  | 'analytics'
  | 'tasks'
  | 'costs'
  | 'gastos'
  | 'explorer'
  | 'assistant'

export function MobileModuleIcon({
  id,
  className = 'h-[1.15rem] w-[1.15rem]',
}: {
  id: MobileModuleIconId
  className?: string
}) {
  const c = className
  switch (id) {
    case 'assistant':
      return (
        <svg className={c} viewBox="0 0 64 64" fill="none" aria-hidden>
          <rect x="16" y="22" width="32" height="26" rx="8" stroke="currentColor" strokeWidth="2.5" />
          <circle cx="26" cy="34" r="4" fill="currentColor" />
          <circle cx="38" cy="34" r="4" fill="currentColor" />
          <path d="M28 42h8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path
            d="M32 12v10M22 16h20"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="10" r="3" fill="currentColor" />
        </svg>
      )
    case 'home':
    case 'menu':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'products':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V5ZM4 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5Zm9 0a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'sales':
    case 'shop':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9h15l-1.5 9h-12L6 9Zm0 0L5 3H2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="9" cy="20" r="1.5" fill="currentColor" />
          <circle cx="18" cy="20" r="1.5" fill="currentColor" />
        </svg>
      )
    case 'pos':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="4" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M7 9h4M7 12h10M7 15h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'inventory':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M21 16.5V8.2a1.9 1.9 0 0 0-.9-1.6l-7-4.1a1.9 1.9 0 0 0-2 0l-7 4.1A1.9 1.9 0 0 0 3 8.2v8.3a1.9 1.9 0 0 0 1 1.6l7 4.1a1.9 1.9 0 0 0 2 0l7-4.1a1.9 1.9 0 0 0 1-1.6Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="m3.3 7.7 8.7 5 8.7-5M12 22V12.7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'purchases':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 7l1.5 12h13L20 7M9 11v5M15 11v5M10 7V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'tasks':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 6h12M9 12h12M9 18h12M5 6l1 1 2-2M5 12l1 1 2-2M5 18l1 1 2-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'staff':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 20c0-3.3 3.1-5 7-5s7 1.7 7 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'analytics':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 18h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="m7 14 3-3 3 2 4-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'costs':
    case 'gastos':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3v18M8 7h6a3 3 0 0 1 0 6H10a3 3 0 0 0 0 6h8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'recipes':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M8 4h8l1 3H7l1-3Zm-1 5h10l-1 11H8L7 9Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'explorer':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" aria-hidden>
          <ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    default:
      return null
  }
}
