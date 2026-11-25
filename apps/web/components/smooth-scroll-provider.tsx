"use client";

import { ReactLenis } from "lenis/react";

export function SmoothScrollProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ReactLenis root options={{ anchors: true, stopInertiaOnNavigate: true }}>
      {children}
    </ReactLenis>
  );
}
