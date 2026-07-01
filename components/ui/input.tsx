import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onFocus, ...props }, ref) => {
    // Sayısal alanlarda değer tam olarak 0 ise, odaklanınca otomatik seç —
    // kullanıcı üzerine gelince "0"ı silmeden direkt rakam girebilsin. 0'dan
    // farklı bir değer varsa seçme (manuel düzenleme). Tüm platformda number
    // input'ları bu bileşeni kullandığı için tek yerden uygulanır.
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (type === "number") {
        const v = (e.currentTarget.value ?? "").trim();
        if (v !== "" && Number(v) === 0) {
          const el = e.currentTarget;
          // setTimeout(0): fare tıklamasıyla gelen focus'ta, tıklama tamamlanınca
          // seçimin kaybolmaması için seçimi bir sonraki tick'e ertele.
          setTimeout(() => {
            try {
              el.select();
            } catch {
              /* number input bazı tarayıcılarda select desteklemeyebilir */
            }
          }, 0);
        }
      }
      onFocus?.(e);
    };
    return (
      <input
        type={type}
        onFocus={handleFocus}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-colors",
          "placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:border-ring",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
