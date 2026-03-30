"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UsuarioAdminItem } from "./page";

type Props = {
  usuariosIniciales: UsuarioAdminItem[];
};

type RolUsuario = "admin" | "empleado";

type EstadoFormulario = {
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
  activo: boolean;
};

const estadoInicialFormulario: EstadoFormulario = {
  nombre: "",
  email: "",
  password: "",
  rol: "empleado",
  activo: true,
};

export function UsuariosAdminClient({ usuariosIniciales }: Props) {
  const router = useRouter();
  const [estaAbiertoFormulario, setEstaAbiertoFormulario] = useState(false);
  const [estadoFormulario, setEstadoFormulario] = useState<EstadoFormulario>(
    estadoInicialFormulario
  );
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const usuariosOrdenados = useMemo(() => {
    return [...usuariosIniciales].sort((a, b) => {
      const nombreA = (a.nombre ?? "").trim().toLowerCase();
      const nombreB = (b.nombre ?? "").trim().toLowerCase();

      if (nombreA && nombreB) {
        return nombreA.localeCompare(nombreB, "es");
      }

      const emailA = (a.email ?? "").trim().toLowerCase();
      const emailB = (b.email ?? "").trim().toLowerCase();
      return emailA.localeCompare(emailB, "es");
    });
  }, [usuariosIniciales]);

  function actualizarCampo<K extends keyof EstadoFormulario>(
    campo: K,
    valor: EstadoFormulario[K]
  ) {
    setEstadoFormulario((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function limpiarFormulario() {
    setEstadoFormulario(estadoInicialFormulario);
    setMensajeError(null);
  }

  async function manejarCrearUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMensajeError(null);
    setMensajeExito(null);

    const nombre = estadoFormulario.nombre.trim();
    const email = estadoFormulario.email.trim().toLowerCase();
    const password = estadoFormulario.password;
    const rol = estadoFormulario.rol;
    const activo = estadoFormulario.activo;

    if (!nombre) {
      setMensajeError("Debes ingresar el nombre del usuario.");
      return;
    }

    if (!email) {
      setMensajeError("Debes ingresar el correo del usuario.");
      return;
    }

    if (!password || password.length < 6) {
      setMensajeError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    startTransition(async () => {
      try {
        const respuesta = await fetch("/api/admin/usuarios", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nombre,
            email,
            password,
            rol,
            activo,
          }),
        });

        const resultado = await respuesta.json().catch(() => null);

        if (!respuesta.ok) {
          setMensajeError(
            resultado?.error ?? "No se pudo crear el usuario en este momento."
          );
          return;
        }

        setMensajeExito("Usuario creado correctamente.");
        limpiarFormulario();
        setEstaAbiertoFormulario(false);
        router.refresh();
      } catch (error) {
        console.error("Error creando usuario:", error);
        setMensajeError("Ocurrió un error inesperado al crear el usuario.");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-400">
            Total de usuarios: {usuariosOrdenados.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMensajeExito(null);
            setMensajeError(null);
            setEstaAbiertoFormulario((valorAnterior) => !valorAnterior);
          }}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
        >
          {estaAbiertoFormulario ? "Cerrar formulario" : "Nuevo usuario"}
        </button>
      </div>

      {mensajeExito ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {mensajeExito}
        </div>
      ) : null}

      {estaAbiertoFormulario ? (
        <form
          onSubmit={manejarCrearUsuario}
          className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="nombre" className="text-sm text-neutral-300">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={estadoFormulario.nombre}
                onChange={(event) =>
                  actualizarCampo("nombre", event.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                placeholder="Juan Pérez"
                autoComplete="name"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-neutral-300">
                Correo
              </label>
              <input
                id="email"
                type="email"
                value={estadoFormulario.email}
                onChange={(event) =>
                  actualizarCampo("email", event.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                placeholder="correo@empresa.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-neutral-300">
                Contraseña temporal
              </label>
              <input
                id="password"
                type="password"
                value={estadoFormulario.password}
                onChange={(event) =>
                  actualizarCampo("password", event.target.value)
                }
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="rol" className="text-sm text-neutral-300">
                Rol
              </label>
              <select
                id="rol"
                value={estadoFormulario.rol}
                onChange={(event) =>
                  actualizarCampo("rol", event.target.value as RolUsuario)
                }
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
              >
                <option value="empleado">Empleado</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-neutral-200">
            <input
              type="checkbox"
              checked={estadoFormulario.activo}
              onChange={(event) =>
                actualizarCampo("activo", event.target.checked)
              }
              className="h-4 w-4"
            />
            Usuario activo
          </label>

          {mensajeError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {mensajeError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Creando..." : "Crear usuario"}
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                limpiarFormulario();
                setMensajeExito(null);
                setEstaAbiertoFormulario(false);
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Nombre
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Correo
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  Estado
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 bg-black/10">
              {usuariosOrdenados.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-6 text-sm text-neutral-400"
                  >
                    No hay usuarios registrados todavía.
                  </td>
                </tr>
              ) : (
                usuariosOrdenados.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-sm text-white">
                      {usuario.nombre || "Sin nombre"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300">
                      {usuario.email || "Sin correo"}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-300">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
                        {usuario.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={
                          usuario.activo
                            ? "rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300"
                            : "rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs text-red-300"
                        }
                      >
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}