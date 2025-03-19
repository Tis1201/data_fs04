import type { VariantProps } from "class-variance-authority"
import type { toastVariants } from "./toast-variants"

export interface ToastProps extends VariantProps<typeof toastVariants> {
  class?: string
  variant?: "default" | "destructive"
  duration?: number
  open?: boolean
  onOpenChange?: (value: boolean) => void
}

export interface ToastActionElement {
  altText: string
  onClick: () => void
  shortcut?: string[]
}
