"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type UsuarioOpcion = {
  id: string;
  nombre: string;
};

type Props = {
  conversacionId: string;
  usuariosActualesIds: string[];
  usuarios: UsuarioOpcion[];
  disabled?: boolean;
};

type RespuestaAsignacion = {
  ok?: boolean;
  error?: string;
};

function arraysIguales(a: string[], b: string[]) {
  if (a.length !== b.length) return false;

  const aOrdenado = [...a].sort();
  const bOrdenado = [...b].sort();

  return aOrdenado.every((valor, indice) => valor === bOrdenado[indice]);
}

export function AsignacionConversacionSelector({
  conversacionId,
  usuariosActualesIds,
  usuarios,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [usuariosSeleccionados, setUsuariosSeleccionados] = useState<string[]>(
    usuariosActualesIds
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const nombresSeleccionados = useMemo(() => {
    const mapaUsuarios = new Map(usuarios.map((usuario) => [usuario.id, usuario.nombre]));

    return usuariosSeleccionados
      .map((id) => mapaUsuarios.get(id))
      .filter((nombre): nombre is string => Boolean(nombre));
  }, [usuarios, usuariosSeleccionados]);

  async function guardarAsignaciones(usuariosNuevos: string[], usuariosPrevios: string[]) {
    try {
      const respuesta = await fetch(
        `/api/conversaciones/${conversacionId}/asignacion`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            usuarioIds: usuariosNuevos,
          }),
        }
      );

      let resultado: RespuestaAsignacion | null = null;
      const contenido = await respuesta.text();

      try {
        resultado = contenido ? JSON.parse(contenido) : null;
      } catch {
        resultado = null;
      }

      if (!respuesta.ok || !resultado?.ok) {
        setUsuariosSeleccionados(usuariosPrevios);

        if (!respuesta.ok && !resultado) {
          setError(
            "El servidor devolvió una respuesta inválida. Revisa la sesión o el endpoint."
          );
          return;
        }

        setError(resultado?.error || "No se pudo actualizar la asignación.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error("Error actualizando asignación:", error);
      setUsuariosSeleccionados(usuariosPrevios);
      setError("Ocurrió un error actualizando la asignación.");
    }
  }

  function manejarCambio(evento: ChangeEvent<HTMLInputElement>) {
    const usuarioId = evento.target.value;
    const marcado = evento.target.checked;
    const valorAnterior = usuariosSeleccionados;

    const valorNuevo = marcado
      ? Array.from(new Set([...usuariosSeleccionados, usuarioId]))
      : usuariosSeleccionados.filter((id) => id !== usuarioId);

    if (arraysIguales(valorAnterior, valorNuevo)) {
      return;
    }

    setUsuariosSeleccionados(valorNuevo);
    setError("");
    void guardarAsignaciones(valorNuevo, valorAnterior);
  }

  return (
    <div className="flex min-w-[240px] flex-col items-end gap-2">
      <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        Asignados a
      </label>

      <div className="w-full rounded-xl border border-neutral-300 bg-white p-3">
        {usuarios.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay empleados disponibles.</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {usuarios.map((usuario) => {
              const checked = usuariosSeleccionados.includes(usuario.id);

              return (
                <label
                  key={usuario.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-neutral-800 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    value={usuario.id}
                    checked={checked}
                    onChange={manejarCambio}
                    disabled={disabled || isPending}
                    className="h-4 w-4 rounded border-neutral-300"
                  />
                  <span>{usuario.nombre}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <p className="max-w-[240px] text-right text-[11px] text-neutral-500">
        {nombresSeleccionados.length > 0
          ? nombresSeleccionados.join(", ")
          : "Sin empleados asignados"}
      </p>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}