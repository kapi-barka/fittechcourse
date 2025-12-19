/**
 * Dialog (Modal) component
 */
'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface DialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onOpenChange(false)
            }
        }

        if (open) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [open, onOpenChange])

    if (!open) return null

    const dialogContent = (
        <div className="fixed inset-0 z-40 flex items-center justify-center pt-20">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={() => onOpenChange(false)}
            />

            {/* Dialog content */}
            <div
                ref={dialogRef}
                className="relative z-40 w-full animate-in fade-in-0 zoom-in-95"
            >
                {children}
            </div>
        </div>
    )

    if (typeof window !== 'undefined') {
        return createPortal(dialogContent, document.body)
    }

    return dialogContent
}

export function DialogContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('mx-auto bg-background rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto', className)}>
            {children}
        </div>
    )
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
    return <div className="mb-4">{children}</div>
}

export function DialogTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return <h2 className={cn('text-xl font-semibold', className)}>{children}</h2>
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
    return <p className="text-sm text-muted-foreground mt-2">{children}</p>
}
