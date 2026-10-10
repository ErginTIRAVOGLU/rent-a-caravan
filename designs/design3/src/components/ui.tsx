import { Children, cloneElement, isValidElement, useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import type { LinkProps } from "next/link";

const buttonStyles = {
  primary: "bg-forest text-white hover:bg-forest-deep focus-visible:ring-forest",
  secondary: "bg-sage-pale text-forest hover:bg-sage-light focus-visible:ring-sage",
  outline: "border border-line bg-white text-ink hover:bg-paper focus-visible:ring-forest",
  ghost: "bg-transparent text-ink-muted hover:bg-paper focus-visible:ring-forest",
  destructive: "bg-error text-white hover:bg-error-deep focus-visible:ring-error",
} as const;

type ButtonVariant = keyof typeof buttonStyles;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }: ButtonProps) {
  const sizes = {
    sm: "min-h-11 px-3.5 text-sm",
    md: "min-h-11 px-5 text-sm",
    lg: "min-h-12 px-6 text-base",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${buttonStyles[variant]} ${sizes[size]} ${className}`}
      type={type}
      {...props}
    />
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string };

export function IconButton({ label, className = "", type = "button", ...props }: IconButtonProps) {
  return <button aria-label={label} type={type} className={`grid min-h-11 min-w-11 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${className}`} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: Omit<LinkProps, "href"> & { href: string; variant?: ButtonVariant; size?: "sm" | "md" | "lg"; className?: string; children: ReactNode }) {
  const sizes = { sm: "min-h-11 px-3.5 text-sm", md: "min-h-11 px-5 text-sm", lg: "min-h-12 px-6 text-base" };
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${buttonStyles[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}

const badgeStyles = {
  neutral: "bg-neutral-soft text-ink-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent-deep",
} as const;

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof badgeStyles }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${badgeStyles[tone]}`}>{children}</span>;
}

export function DemoBanner({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning ${className}`} role="note">
      <span className="mt-0.5 inline-block size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      <p><strong>Demo görünümü.</strong> Örnek içerikler gösterilir; bu sayfada sunucuya veya kalıcı hesaba kayıt yapılmaz.</p>
    </div>
  );
}

export function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-sage-strong">{eyebrow}</p> : null}
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-ink-muted sm:text-base">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-12 text-center">
      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-sage-pale text-forest" aria-hidden="true">✦</div>
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

type FieldChildProps = { children?: ReactNode; id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean };

function addFieldAccessibility(children: ReactNode, controlId: string, describedBy: string, invalid: boolean): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<FieldChildProps>(child)) return child;
    if (child.type === "input" || child.type === "select" || child.type === "textarea") {
      const existing = child.props["aria-describedby"];
      return cloneElement(child, {
        id: child.props.id ?? controlId,
        "aria-describedby": [existing, describedBy].filter(Boolean).join(" ") || undefined,
        "aria-invalid": invalid || undefined,
      });
    }
    return child.props.children ? cloneElement(child, { children: addFieldAccessibility(child.props.children, controlId, describedBy, invalid) }) : child;
  });
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ");
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-ink">
      <span>{label}</span>
      {addFieldAccessibility(children, controlId, describedBy, Boolean(error))}
      {hint ? <span id={hintId} className="text-xs font-normal text-ink-muted">{hint}</span> : null}
      {error ? <span id={errorId} className="text-xs font-semibold text-error" role="alert">{error}</span> : null}
    </label>
  );
}

export const inputClass = "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink outline-none transition focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/15 placeholder:text-ink-faint disabled:bg-neutral-soft";
