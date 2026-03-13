"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearClienteSupabaseNavegador } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = crearClienteSupabaseNavegador();

  const [email, setEmail] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function manejarLogin(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCargando(true);
    setError("");

    const { error: errorLogin } = await supabase.auth.signInWithPassword({
      email,
      password: contrasena,
    });

    setCargando(false);

    if (errorLogin) {
      setError("Correo o contraseña incorrectos.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-6">
        <h1 className="text-2xl font-bold text-center mb-2 text-black">
          Iniciar sesión
        </h1>

        <p className="text-sm text-neutral-500 text-center mb-6">
          Accede al panel de conversaciones
        </p>

        <form onSubmit={manejarLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-black">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-black placeholder:text-neutral-400 outline-none focus:border-black"
              placeholder="correo@ejemplo.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-black">
              Contraseña
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-black placeholder:text-neutral-400 outline-none focus:border-black"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-xl bg-black py-2 font-medium text-white disabled:opacity-50"
          >
            {cargando ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}