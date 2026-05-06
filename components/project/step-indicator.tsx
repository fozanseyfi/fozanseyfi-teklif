"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Proje Bilgileri" },
  { number: 2, label: "Teknik & Fiyat" },
  { number: 3, label: "Ekipman" },
  { number: 4, label: "Finansal" },
  { number: 5, label: "Teklif & PDF" },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="mb-8 flex items-center justify-center">
      {STEPS.map((step, index) => {
        const isDone = currentStep > step.number;
        const isActive = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                  isDone && "bg-primary text-primary-foreground shadow-sm",
                  isActive &&
                    "bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/20",
                  !isDone &&
                    !isActive &&
                    "border bg-secondary text-muted-foreground",
                )}
              >
                {isDone ? <Check className="size-4" /> : step.number}
              </div>
              <span
                className={cn(
                  "hidden whitespace-nowrap text-xs font-medium sm:block",
                  isActive
                    ? "text-primary"
                    : isDone
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 mb-5 h-[2px] w-12 transition-colors lg:w-20",
                  currentStep > step.number ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
