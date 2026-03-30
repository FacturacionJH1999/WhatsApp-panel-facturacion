"use client";

import { useEffect, useMemo, useState } from "react";

export type ItemGaleria = {
  id: string;
  tipo: "image" | "video";
  url: string;
  nombreArchivo: string | null;
  mimeType: string | null;
  fechaMensaje: string | null;
};

type Props = {
  items: ItemGaleria[];
  mensajeActualId: string;
  tipo: "image" | "video";
  url: string;
  nombreArchivo: string | null;
  mimeType: string | null;
};

export function GaleriaMultimedia({
  items,
  mensajeActualId,
  tipo,
  url,
  nombreArchivo,
  mimeType,
}: Props) {
  const indiceInicial = useMemo(() => {
    const indiceEncontrado = items.findIndex((item) => item.id === mensajeActualId);
    return indiceEncontrado >= 0 ? indiceEncontrado : 0;
  }, [items, mensajeActualId]);

  const [estaAbierto, setEstaAbierto] = useState(false);
  const [indiceActual, setIndiceActual] = useState(indiceInicial);
  const [toqueInicialX, setToqueInicialX] = useState<number | null>(null);

  useEffect(() => {
    setIndiceActual(indiceInicial);
  }, [indiceInicial]);

  useEffect(() => {
    if (!estaAbierto) {
      return;
    }

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const manejarTeclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEstaAbierto(false);
        return;
      }

      if (event.key === "ArrowLeft") {
        setIndiceActual((anterior) =>
          anterior > 0 ? anterior - 1 : items.length - 1
        );
      }

      if (event.key === "ArrowRight") {
        setIndiceActual((anterior) =>
          anterior < items.length - 1 ? anterior + 1 : 0
        );
      }
    };

    window.addEventListener("keydown", manejarTeclado);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", manejarTeclado);
    };
  }, [estaAbierto, items.length]);

  const itemActual = items[indiceActual] ?? null;
  const puedeNavegar = items.length > 1;

  function abrirVisor() {
    setIndiceActual(indiceInicial);
    setEstaAbierto(true);
  }

  function irAnterior() {
    setIndiceActual((anterior) =>
      anterior > 0 ? anterior - 1 : items.length - 1
    );
  }

  function irSiguiente() {
    setIndiceActual((anterior) =>
      anterior < items.length - 1 ? anterior + 1 : 0
    );
  }

  function manejarTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    setToqueInicialX(touch.clientX);
  }

  function manejarTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    if (toqueInicialX === null) return;

    const touch = event.changedTouches[0];
    if (!touch) {
      setToqueInicialX(null);
      return;
    }

    const diferencia = touch.clientX - toqueInicialX;
    const umbral = 50;

    if (Math.abs(diferencia) >= umbral && puedeNavegar) {
      if (diferencia > 0) {
        irAnterior();
      } else {
        irSiguiente();
      }
    }

    setToqueInicialX(null);
  }

  if (tipo === "image") {
    return (
      <>
        <div className="mt-2">
          <button
            type="button"
            onClick={abrirVisor}
            className="block w-full cursor-zoom-in"
          >
            <img
              src={url}
              alt={nombreArchivo || "Imagen recibida"}
              className="max-h-[420px] w-full rounded-xl border border-black/10 bg-black/5 object-contain"
            />
          </button>
        </div>

        {estaAbierto && itemActual ? (
          <div className="fixed inset-0 z-[100] bg-black/90">
            <div
              className="flex h-full w-full items-center justify-center px-4 py-6"
              onTouchStart={manejarTouchStart}
              onTouchEnd={manejarTouchEnd}
            >
              <button
                type="button"
                onClick={() => setEstaAbierto(false)}
                className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
              >
                Cerrar
              </button>

              <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white">
                {indiceActual + 1} / {items.length}
              </div>

              {puedeNavegar ? (
                <button
                  type="button"
                  onClick={irAnterior}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-xl text-white hover:bg-white/20"
                >
                  ‹
                </button>
              ) : null}

              <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center">
                {itemActual.tipo === "image" ? (
                  <img
                    src={itemActual.url}
                    alt={itemActual.nombreArchivo || "Imagen"}
                    className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
                  />
                ) : (
                  <video
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[80vh] w-full max-w-5xl rounded-2xl bg-black object-contain"
                  >
                    <source
                      src={itemActual.url}
                      type={itemActual.mimeType ?? "video/mp4"}
                    />
                    Tu navegador no soporta video.
                  </video>
                )}

                <div className="mt-4 flex max-w-3xl flex-col items-center text-center text-white">
                  <p className="text-sm font-medium">
                    {itemActual.nombreArchivo ||
                      (itemActual.tipo === "image" ? "Imagen" : "Video")}
                  </p>
                  <a
                    href={itemActual.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 text-xs underline opacity-80"
                  >
                    Abrir en otra pestaña
                  </a>
                </div>
              </div>

              {puedeNavegar ? (
                <button
                  type="button"
                  onClick={irSiguiente}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-xl text-white hover:bg-white/20"
                >
                  ›
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mt-2">
        <video
          controls
          preload="metadata"
          playsInline
          className="max-h-[420px] w-full rounded-xl border border-black/10 bg-black"
        >
          <source src={url} type={mimeType ?? "video/mp4"} />
          Tu navegador no soporta video.
        </video>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirVisor}
            className="inline-flex items-center justify-center rounded-lg border border-black bg-black px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Abrir visor
          </button>

          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Abrir video en otra pestaña
          </a>
        </div>
      </div>

      {estaAbierto && itemActual ? (
        <div className="fixed inset-0 z-[100] bg-black/90">
          <div
            className="flex h-full w-full items-center justify-center px-4 py-6"
            onTouchStart={manejarTouchStart}
            onTouchEnd={manejarTouchEnd}
          >
            <button
              type="button"
              onClick={() => setEstaAbierto(false)}
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
            >
              Cerrar
            </button>

            <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-medium text-white">
              {indiceActual + 1} / {items.length}
            </div>

            {puedeNavegar ? (
              <button
                type="button"
                onClick={irAnterior}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-xl text-white hover:bg-white/20"
              >
                ‹
              </button>
            ) : null}

            <div className="flex h-full w-full max-w-6xl flex-col items-center justify-center">
              {itemActual.tipo === "image" ? (
                <img
                  src={itemActual.url}
                  alt={itemActual.nombreArchivo || "Imagen"}
                  className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
                />
              ) : (
                <video
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[80vh] w-full max-w-5xl rounded-2xl bg-black object-contain"
                >
                  <source
                    src={itemActual.url}
                    type={itemActual.mimeType ?? "video/mp4"}
                  />
                  Tu navegador no soporta video.
                </video>
              )}

              <div className="mt-4 flex max-w-3xl flex-col items-center text-center text-white">
                <p className="text-sm font-medium">
                  {itemActual.nombreArchivo ||
                    (itemActual.tipo === "image" ? "Imagen" : "Video")}
                </p>
                <a
                  href={itemActual.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 text-xs underline opacity-80"
                >
                  Abrir en otra pestaña
                </a>
              </div>
            </div>

            {puedeNavegar ? (
              <button
                type="button"
                onClick={irSiguiente}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-white/10 px-4 py-3 text-xl text-white hover:bg-white/20"
              >
                ›
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}