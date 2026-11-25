"use client";

import { useCallback, useSyncExternalStore } from "react";

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
const finePointerQuery = "(hover: hover) and (pointer: fine)";

function useMediaQuery(query: string) {
  const subscribeToQuery = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query],
  );

  return useSyncExternalStore(subscribeToQuery, getSnapshot, () => false);
}

export function usePrefersReducedMotion() {
  return useMediaQuery(reducedMotionQuery);
}

export function useFinePointer() {
  return useMediaQuery(finePointerQuery);
}
