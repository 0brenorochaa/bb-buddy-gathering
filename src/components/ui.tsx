import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const tap = "transition-transform duration-150 ease-out active:not-disabled:scale-[0.96]";

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "gold" | "ghost" | "quiet";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold tracking-wide uppercase disabled:opacity-55",
        tap,
        variant === "primary" && "bg-navy text-paper",
        variant === "gold" && "bg-gold text-navy",
        variant === "ghost" && "bg-transparent text-paper",
        variant === "quiet" && "bg-card text-navy shadow-field",
        className,
      )}
      {...props}
    />
  );
}

export function TextField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <input
        id={id}
        className={cn(
          "mt-2 h-12 w-full rounded-xl bg-card px-3 text-base font-normal text-ink shadow-field placeholder:text-muted",
          className,
        )}
        {...props}
      />
      {hint ? <span className="mt-1 block text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = props.id ?? props.name;
  return (
    <label className="block text-sm font-medium text-ink" htmlFor={id}>
      {label}
      <select
        id={id}
        className="mt-2 h-12 w-full rounded-xl bg-card px-3 text-base font-normal text-ink shadow-field"
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Alert({ tone = "error", children }: { tone?: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-xl px-3 py-3 text-sm",
        tone === "error" ? "bg-navy text-paper" : "bg-gold/20 text-navy",
      )}
    >
      {children}
    </p>
  );
}
