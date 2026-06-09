import { POS_STAFF } from '../../constants'
import type { PosStaffMember } from '../../types'

type Props = {
  value: PosStaffMember | null
  onChange: (staff: PosStaffMember) => void
  label?: string
  compact?: boolean
}

export function PosStaffPicker({
  value,
  onChange,
  label = 'Atendió',
  compact,
}: Props) {
  return (
    <div
      className={`pos-staff-picker${compact ? ' pos-staff-picker--compact' : ''}`}
    >
      <span className="pos-staff-picker__label">{label}</span>
      <div className="pos-staff-picker__chips" role="group" aria-label={label}>
        {POS_STAFF.map((name) => (
          <button
            key={name}
            type="button"
            className={`pos-staff-picker__chip${value === name ? ' pos-staff-picker__chip--active' : ''}`}
            aria-pressed={value === name}
            onClick={() => onChange(name)}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
