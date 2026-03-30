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
        className="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
      >
        {aliasActual?.trim() ? "Editar apodo" : "Agregar apodo"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <input
        type="text"
        value={alias}
        onChange={(e) => setAlias(e.target.value)}
        placeholder="Escribe un apodo"
        className="rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={isPending}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
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
          className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}