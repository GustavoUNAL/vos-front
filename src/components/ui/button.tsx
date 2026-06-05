import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva('vos-btn', {
  variants: {
    variant: {
      primary: 'vos-btn--primary',
      secondary: 'vos-btn--secondary',
      ghost: 'vos-btn--ghost',
      accent: 'vos-btn--accent-soft',
      danger: 'vos-btn--danger',
    },
    size: {
      sm: 'vos-btn--sm',
      md: 'vos-btn--md',
      lg: 'vos-btn--lg',
      icon: 'vos-btn--icon',
      'icon-sm': 'vos-btn--icon-sm',
    },
    block: {
      true: 'vos-btn--block',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
    block: false,
  },
})

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  ),
)

Button.displayName = 'Button'

export { buttonVariants }
