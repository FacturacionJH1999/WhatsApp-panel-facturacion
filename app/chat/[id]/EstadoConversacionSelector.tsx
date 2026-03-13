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
    <div className="flex flex-col items-end gap-1">
      <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        Estado
      </label>

      <select
        value={estado}
        onChange={manejarCambio}
        disabled={disabled || isPending}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-black disabled:opacity-60"
      >
        {OPCIONES.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>
            {opcion.label}
          </option>
        ))}
      </select>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}