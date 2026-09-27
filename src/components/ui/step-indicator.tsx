import React from "react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  className,
}: StepIndicatorProps) {
  return (
    <ol className={cn("flex flex-wrap items-center gap-3", className)}>
      {steps.map((stepLabel, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;
        const isUpcoming = idx > currentStep;
        const isClickable = Boolean(onStepClick) && isCompleted;

        return (
          <li
            key={stepLabel}
            className={cn("flex items-center gap-2", isClickable && "cursor-pointer")}
            onClick={() => isClickable && onStepClick?.(idx)}
          >
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full text-sm font-bold transition-colors",
                isCompleted && "bg-turq text-ink",
                isCurrent && "bg-coral text-coral-foreground",
                isUpcoming && "bg-gray-200 dark:bg-gray-800 text-gray-400"
              )}
            >
              {idx + 1}
            </span>
            <span
              className={cn(
                "text-sm font-semibold transition-colors",
                isCurrent ? "text-gray-900 dark:text-white" : "text-gray-500"
              )}
            >
              {stepLabel}
            </span>
            {idx < steps.length - 1 && (
              <span className="mx-1 hidden h-0.5 w-6 bg-gray-200 dark:bg-gray-800 sm:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
