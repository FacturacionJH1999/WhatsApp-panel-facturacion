"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type UsuarioOpcion = {
  id: string;
  nombre: string;
};

type Props = {
  conversacionId: string;
  usuarioActualId: string | null;
  usuarios: UsuarioOpcion[];
  disabled?: boolean;
};

export function AsignacionConversacionSelector({
  conversacionId,
  usuarioActualId,
  usuarios,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(
    usuarioActualId ?? ""
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  async function manejarCambio(evento: ChangeEvent<HTMLSelectElement>) {
    const valorNuevo = evento.target.value;
    const valorAnterior = usuarioSeleccionado;

    setUsuarioSeleccionado(valorNuevo);
    setError("");

    try {
      const respuesta = await fetch(
        `/api/conversaciones/${conversacionId}/asignacion`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usuarioId: valorNuevo || null,
          }),
        }
      );

      const resultado = await respuesta.json();

      if (!respuesta.ok || !resultado?.ok) {
        setUsuarioSeleccionado(valorAnterior);
        setError(resultado?.error || "No se pudo actualizar la asignación.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setUsuarioSeleccionado(valorAnterior);
      setError("Ocurrió un error actualizando la asignación.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        Asignado a
      </label>

      <select
        value={usuarioSeleccionado}
        onChange={manejarCambio}
        disabled={disabled || isPending}
        className="min-w-[180px] rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800 outline-none focus:border-black disabled:opacity-60"
      >
        <option value="">Sin asignar</option>

        {usuarios.map((usuario) => (
          <option key={usuario.id} value={usuario.id}>
            {usuario.nombre}
          </option>
        ))}
      </select>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}