"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type EstadoConversacion = "nueva" | "en_proceso" | "cerrada";

type Props = {
  conversacionId: string;
  estadoActual: EstadoConversacion;
  disabled?: boolean;
};

const OPCIONES: Array<{ value: EstadoConversacion; label: string }> = [
  { value: "nueva", label: "Nueva" },
  { value: "en_proceso", label: "En proceso" },
  { value: "cerrada", label: "Cerrada" },
];

export function EstadoConversacionSelector({
  conversacionId,
  estadoActual,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<EstadoConversacion>(estadoActual);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function manejarCambio(evento: ChangeEvent<HTMLSelectElement>) {
    const nuevoEstado = evento.target.value as EstadoConversacion;
    const estadoAnterior = estado;

    setEstado(nuevoEstado);
    setError("");

    try {
      const respuesta = await fetch(
        `/api/conversaciones/${conversacionId}/estado`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ estado: nuevoEstado }),
        }
      );

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado?.ok) {
        setEstado(estadoAnterior);
        setError(resultado?.error || "No se pudo actualizar el estado.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setEstado(estadoAnterior);
      setError("Ocurrió un error actualizando el estado.");
    }
  }

  return (
    <div className="flex min-w-[170px] flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Estado
      </label>

      <select
        value={estado}
        onChange={manejarCambio}
        disabled={disabled || isPending}
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition hover:border-slate-300 focus:border-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {OPCIONES.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>

      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}