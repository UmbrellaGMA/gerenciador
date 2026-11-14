"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText = "Aguarde…",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
    ghost: "bg-transparent ring-1 ring-zinc-300 hover:bg-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800",
    danger: "bg-transparent text-red-600 ring-1 ring-red-300 hover:bg-red-50 dark:ring-red-900 dark:hover:bg-red-950",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-60 ${styles} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function ConfirmDelete({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Excluir este cliente e todo o histórico?")) e.preventDefault();
      }}
    >
      <SubmitButton variant="danger" pendingText="Excluindo…">
        Excluir cliente
      </SubmitButton>
    </form>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={async (e) => {
        const btn = e.currentTarget;
        await navigator.clipboard.writeText(text);
        btn.textContent = "Copiado!";
        setTimeout(() => (btn.textContent = label), 1500);
      }}
      className="rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-zinc-300 hover:bg-zinc-100 dark:ring-zinc-700 dark:hover:bg-zinc-800"
    >
      {label}
    </button>
  );
}
