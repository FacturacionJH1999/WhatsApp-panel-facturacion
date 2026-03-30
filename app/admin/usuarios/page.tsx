import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { UsuariosAdminClient } from "./UsuariosAdminClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type UsuarioAdminItem = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: "admin" | "empleado";
  activo: boolean;
};

export default async function UsuariosPage() {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("perfiles")
    .select("id, nombre, email, rol, activo")
    .order("nombre", { ascending: true });

  if (error) {
    console.error("Error cargando usuarios:", error);
  }

  const usuarios: UsuarioAdminItem[] =
    data?.map((usuario) => ({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      activo: usuario.activo,
    })) ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-neutral-400">Administración</p>
            <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 transition hover:bg-white/10"
          >
            Volver
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/20">
          <div className="mb-4">
            <h2 className="text-lg font-medium">Gestión de usuarios</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Desde aquí puedes crear usuarios con rol admin o empleado.
            </p>
          </div>

          <UsuariosAdminClient usuariosIniciales={usuarios} />
        </section>
      </div>
    </main>
  );
}