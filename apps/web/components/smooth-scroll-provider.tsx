"use client";

import { useSyncExternalStore } from "react";
import { ReactLenis } from "lenis/react";
import { usePrefersReducedMotion } from "@/lib/motion-environment";

export function SmoothScrollProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const reduce = usePrefersReducedMotion();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted || reduce) return <>{children}</>;

  return (
    <ReactLenis root options={{ anchors: true, stopInertiaOnNavigate: true }}>
      {children}
    </ReactLenis>
  );
}
