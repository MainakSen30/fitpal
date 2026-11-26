"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEditorialMotion } from "@/lib/motion-system";

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
  const { introWithDelay, viewport } = useEditorialMotion();

  return (
    <motion.div
      data-motion-reveal
      variants={introWithDelay(delay)}
      initial="hidden"
      {...(inView
        ? { whileInView: "visible", viewport }
        : { animate: "visible" })}
      className={className}
    >
      {children}
    </motion.div>
  );
}
