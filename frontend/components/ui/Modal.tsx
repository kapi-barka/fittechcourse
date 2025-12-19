/**
 * Модальное окно
 */
import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  className
}: ModalProps) => {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 pt-20 animate-in fade-in duration-200"
      onClick={handleOverlayClick}
      ref={overlayRef}
    >
      <div
        className={cn(
          "bg-background rounded-lg shadow-xl w-full max-w-md border relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 rounded-full opacity-70 hover:opacity-100 z-10"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>

        {(title || description) && (
          <div className="p-6 pb-4">
            {title && <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>}
            {description && <p className="text-sm text-muted-foreground mt-2">{description}</p>}
          </div>
        )}

        {children && <div className="p-6 pt-0">{children}</div>}

        {footer && (
          <div className="p-6 pt-0 flex justify-end space-x-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )

  if (typeof window !== 'undefined') {
    return createPortal(modalContent, document.body)
  }

  return modalContent
}
