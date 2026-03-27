"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoRefreshHome({
  intervaloMs = 3000,
}: {
  intervaloMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const intervalo = setInterval(() => {
      router.refresh();
    }, intervaloMs);

    return () => clearInterval(intervalo);
  }, [router, intervaloMs]);

  return null;
}