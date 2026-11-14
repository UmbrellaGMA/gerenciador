"use client";

import { useRef, useState, useTransition } from "react";
import { updateFeeAction } from "@/app/actions";

const toText = (v: number | null) =>
  v === null || v === undefined ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Campo de mensalidade editável direto na lista: salva ao apertar Enter ou sair do campo. */
export function FeeInput({ id, value }: { id: string; value: number | null }) {
  const [text, setText] = useState(toText(value));
  const [saved, setSaved] = useState(toText(value));
  const [state, setState] = useState<"idle" | "ok" | "erro">("idle");
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);

  function save() {
    if (text.trim() === saved) return;
    start(async () => {
      try {
        const res = await updateFeeAction(id, text);
        if (res.ok) {
          const t = toText(res.value);
          setText(t);
          setSaved(t);
          setState("ok");
          setTimeout(() => setState("idle"), 1500);
        } else {
          setState("erro");
        }
      } catch {
        setState("erro");
      }
    });
  }

  const ring =
    state === "ok"
      ? "border-emerald-500 ring-2 ring-emerald-500/20"
      : state === "erro"
        ? "border-red-500 ring-2 ring-red-500/20"
        : "border-transparent hover:border-zinc-300 focus:border-zinc-500 dark:hover:border-zinc-700";

  return (
    <div className="relative flex items-center">
      <span className="pointer-events-none absolute left-2 text-xs text-zinc-400">R$</span>
      <input
        ref={ref}
        value={text}
        inputMode="decimal"
        placeholder="0,00"
        disabled={pending}
        aria-label="Mensalidade"
        title={state === "erro" ? "Não foi possível salvar" : "Digite o valor e aperte Enter"}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") ref.current?.blur();
          if (e.key === "Escape") {
            setText(saved);
            setTimeout(() => ref.current?.blur());
          }
        }}
        className={`w-28 rounded-md border bg-transparent py-1 pl-7 pr-2 text-sm tabular-nums outline-none transition disabled:opacity-60 ${ring}`}
      />
    </div>
  );
}
