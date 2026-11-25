"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/motion-environment";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function MotionReveal({
  children,
  className,
  delay = 0,
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const hidden = { opacity: 0, y: 8 };
  const visible = { opacity: 1, y: 0 };
  const transition = {
    duration: reduceMotion ? 0 : 0.2,
    delay: reduceMotion ? 0 : delay,
    ease: easeOut,
  };

  return (
    <motion.div
      data-motion-reveal
      initial={reduceMotion ? false : hidden}
      {...(inView
        ? { whileInView: visible, viewport: { once: true, amount: 0.15 } }
        : { animate: visible })}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
