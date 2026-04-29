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
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((step, index) => {
        const isDone = currentStep > step.number;
        const isActive = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all",
                  isDone && "bg-amber-500 text-white shadow-sm shadow-amber-500/30",
                  isActive && "bg-amber-500 text-white ring-4 ring-amber-500/20 shadow-sm shadow-amber-500/30",
                  !isDone && !isActive && "bg-slate-100 text-slate-400 border border-slate-200"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={cn(
                  "text-xs font-medium hidden sm:block whitespace-nowrap",
                  isActive ? "text-amber-600" : isDone ? "text-slate-500" : "text-slate-400"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-[2px] w-12 lg:w-20 mx-1 mb-5 transition-colors",
                  currentStep > step.number ? "bg-amber-500" : "bg-slate-200"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
