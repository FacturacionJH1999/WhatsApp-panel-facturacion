"use client";

import { useRef, useState } from "react";

type EnviarMensajeProps = {
  telefono: string;
  conversacionId: string;
  puedeEnviar?: boolean;
};

export function EnviarMensaje({
  telefono,
  conversacionId,
  puedeEnviar = true,
}: EnviarMensajeProps) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  async function enviarTexto() {
    if (
      !puedeEnviar ||
      !texto.trim() ||
      !telefono ||
      !conversacionId ||
      enviando
    ) {
      return;
    }

    setEnviando(true);

    try {
      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          telefono,
          conversacionId,
          texto: texto.trim(),
          tipo: "text",
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Sesión no válida:", data);
        } else if (response.status === 403) {
          console.error("Usuario sin permisos para enviar mensajes:", data);
        } else {
          console.error("Error enviando mensaje:", {
            status: response.status,
            data,
          });
        }
        return;
      }

      setTexto("");
      window.location.reload();
    } catch (error) {
      console.error("Error enviando mensaje:", error);
    } finally {
      setEnviando(false);
    }
  }

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];

    if (
      !puedeEnviar ||
      !archivo ||
      !telefono ||
      !conversacionId ||
      enviando
    ) {
      return;
    }

    setEnviando(true);

    try {
      const formData = new FormData();
      formData.append("telefono", telefono);
      formData.append("conversacionId", conversacionId);
      formData.append("texto", texto.trim());
      formData.append("archivo", archivo);

      const response = await fetch("/api/whatsapp/enviar", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          console.error("Sesión no válida:", data);
        } else if (response.status === 403) {
          console.error("Usuario sin permisos para enviar archivos:", data);
        } else {
          console.error("Error enviando archivo:", {
            status: response.status,
            data,
          });
        }
        return;
      }

      setTexto("");
      window.location.reload();
    } catch (error) {
      console.error("Error enviando archivo:", error);
    } finally {
      setEnviando(false);

      if (inputArchivoRef.current) {
        inputArchivoRef.current.value = "";
      }
    }
  }

  if (!puedeEnviar) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 shadow-sm">
        Esta conversación está en modo solo lectura.
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-3 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <button
          type="button"
          onClick={() => inputArchivoRef.current?.click()}
          disabled={enviando || !telefono || !conversacionId}
          className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Adjuntar
        </button>

        <input
          ref={inputArchivoRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={manejarArchivo}
        />

        <div className="flex-1">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                enviarTexto();
              }
            }}
            placeholder="Escribe un mensaje..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-700"
          />
        </div>

        <button
          type="button"
          onClick={enviarTexto}
          disabled={enviando || !texto.trim() || !telefono || !conversacionId}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
}