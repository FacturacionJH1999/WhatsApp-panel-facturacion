"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  contactoId: string;
  aliasActual?: string | null;
  puedeEditar: boolean;
};

export function EditarAliasContacto({
  contactoId,
  aliasActual,
  puedeEditar,
}: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [alias, setAlias] = useState(aliasActual ?? "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function guardar() {
    setError("");

    try {
      const res = await fetch(`/api/contactos/${contactoId}/alias`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alias }),
      });

      if (!res.ok) {
        throw new Error("No se pudo guardar");
      }

      setEditando(false);

      startTransition(() => {
        router.refresh();
      });
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el apodo");
    }
  }

  if (!puedeEditar) return null;

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => setEditando(true)}
        className="mt-2 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        {aliasActual?.trim() ? "Editar apodo" : "Agregar apodo"}
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Escribe un apodo"
          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-teal-700"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={guardar}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-teal-700 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Guardando..." : "Guardar"}
          </button>

          <button
            type="button"
            onClick={() => {
              setEditando(false);
              setAlias(aliasActual ?? "");
              setError("");
            }}
            disabled={isPending}
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>

        {error ? (
          <p className="text-xs font-medium text-rose-600">{error}</p>
        ) : null}
      </div>
    </div>
  );
}