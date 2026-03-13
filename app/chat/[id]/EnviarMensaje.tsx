"use client";

import { useState } from "react";

export function EnviarMensaje({ telefono }: { telefono: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim() || !telefono || enviando) return;

    setEnviando(true);

    try {
      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telefono,
          texto: texto.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        console.error("Error enviando mensaje:", data);
        return;
      }

      setTexto("");
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            enviar();
          }
        }}
        placeholder="Escribe un mensaje..."
        className="flex-1 rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none"
      />

      <button
        type="button"
        onClick={enviar}
        disabled={enviando || !texto.trim() || !telefono}
        className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {enviando ? "Enviando..." : "Enviar"}
      </button>
    </div>
  );
}