import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Accordion = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("space-y-1", className)} {...props} />
))
Accordion.displayName = "Accordion"

const AccordionItem = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("border rounded-lg bg-card text-card-foreground shadow-sm", className)} {...props} />
))
AccordionItem.displayName = "AccordionItem"

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isOpen?: boolean
}

const AccordionTrigger = React.forwardRef<
    HTMLButtonElement,
    AccordionTriggerProps
>(({ className, children, isOpen, ...props }, ref) => (
    <button
        ref={ref}
        className={cn(
            "flex flex-1 items-center justify-between py-4 px-4 font-medium transition-all w-full text-left",
            className
        )}
        {...props}
    >
        {children}
        <ChevronDown
            className={cn(
                "h-4 w-4 shrink-0 transition-transform duration-200",
                isOpen && "rotate-180"
            )}
        />
    </button>
))
AccordionTrigger.displayName = "AccordionTrigger"

interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
    isOpen?: boolean
}

const AccordionContent = React.forwardRef<
    HTMLDivElement,
    AccordionContentProps
>(({ className, children, isOpen, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out",
            isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
        )}
        {...props}
    >
        <div className={cn("px-4 pb-4 pt-0", className)}>{children}</div>
    </div>
))
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
