"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const segmentedControlVariants = cva(
  "inline-flex items-center rounded-lg bg-muted p-0.5",
  {
    variants: {
      size: {
        default: "h-9",
        sm: "h-8",
        lg: "h-10",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

const segmentedControlItemVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      size: {
        default: "h-8 px-3 text-sm",
        sm: "h-7 px-2.5 text-xs",
        lg: "h-9 px-4 text-sm",
      },
      state: {
        active:
          "bg-background text-foreground shadow-sm",
        inactive:
          "text-muted-foreground hover:text-foreground hover:bg-background/50",
      },
    },
    defaultVariants: {
      size: "default",
      state: "inactive",
    },
  }
)

export interface SegmentedControlOption<T extends string = string> {
  value: T
  label: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface SegmentedControlProps<T extends string = string>
  extends VariantProps<typeof segmentedControlVariants> {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  /** Show only icons when true (labels hidden but still accessible) */
  iconOnly?: boolean
  className?: string
  disabled?: boolean
}

function SegmentedControl<T extends string = string>({
  className,
  size,
  value,
  onValueChange,
  options,
  iconOnly = false,
  disabled = false,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(newValue) => {
        // Prevent deselection - always require a selected value
        if (newValue) {
          onValueChange(newValue as T)
        }
      }}
      disabled={disabled}
      className={cn(segmentedControlVariants({ size }), className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          aria-label={option.label}
          className={cn(
            segmentedControlItemVariants({
              size,
              state: value === option.value ? "active" : "inactive",
            })
          )}
        >
          {option.icon}
          {!iconOnly && <span>{option.label}</span>}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  )
}

export { SegmentedControl, segmentedControlVariants, segmentedControlItemVariants }
