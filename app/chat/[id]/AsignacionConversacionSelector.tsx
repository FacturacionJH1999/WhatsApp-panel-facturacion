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
    const mapaUsuarios = new Map(
      usuarios.map((usuario) => [usuario.id, usuario.nombre])
    );

    return usuariosSeleccionados
      .map((id) => mapaUsuarios.get(id))
      .filter((nombre): nombre is string => Boolean(nombre));
  }, [usuarios, usuariosSeleccionados]);

  async function guardarAsignaciones(
    usuariosNuevos: string[],
    usuariosPrevios: string[]
  ) {
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
    <div className="flex min-w-[280px] flex-col gap-2">
      <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Asignados a
      </label>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {usuarios.length === 0 ? (
          <p className="text-sm text-slate-500">
            No hay empleados disponibles.
          </p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {usuarios.map((usuario) => {
              const checked = usuariosSeleccionados.includes(usuario.id);

              return (
                <label
                  key={usuario.id}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    value={usuario.id}
                    checked={checked}
                    onChange={manejarCambio}
                    disabled={disabled || isPending}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700"
                  />
                  <span className="font-medium">{usuario.nombre}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <p className="max-w-[280px] text-[11px] leading-5 text-slate-500 xl:text-right">
        {nombresSeleccionados.length > 0
          ? nombresSeleccionados.join(", ")
          : "Sin empleados asignados"}
      </p>

      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}