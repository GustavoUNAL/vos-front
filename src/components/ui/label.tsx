import { type LabelHTMLAttributes, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

type LabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  children: ReactNode
}

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label className={cn('vos-label', className)} {...props}>
      {children}
    </label>
  )
}
