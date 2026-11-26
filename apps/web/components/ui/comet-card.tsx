"use client";
import React, { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from "motion/react";
import { cn } from "@/lib/utils";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/motion-environment";

export const CometCard = ({
  rotateDepth = 17.5,
  translateDepth = 20,
  className,
  children,
}: {
  rotateDepth?: number;
  translateDepth?: number;
  className?: string;
  children: React.ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reduceMotion = usePrefersReducedMotion();
  const interactive = finePointer && !reduceMotion;

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 260, damping: 30, mass: 0.6 });
  const mouseYSpring = useSpring(y, { stiffness: 260, damping: 30, mass: 0.6 });

  const tiltDepth = Math.min(rotateDepth, 8);
  const shiftDepth = Math.min(translateDepth, 8);

  const rotateX = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`-${tiltDepth}deg`, `${tiltDepth}deg`],
  );
  const rotateY = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${tiltDepth}deg`, `${tiltDepth}deg`],
  );

  const translateX = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${shiftDepth}px`, `${shiftDepth}px`],
  );
  const translateY = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`-${shiftDepth}px`, `${shiftDepth}px`],
  );

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], [0, 100]);

  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(247,240,228,0.10) 10%, rgba(247,240,228,0.05) 20%, rgba(255,255,255,0) 80%)`;

  useEffect(() => {
    if (!interactive) {
      x.set(0);
      y.set(0);
    }
  }, [interactive, x, y]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.pointerType !== "mouse" || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPct = (event.clientX - rect.left) / rect.width - 0.5;
    const yPct = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className={cn("relative", className)} style={interactive ? { perspective: 1200 } : undefined}>
      <motion.div
        ref={ref}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerLeave={interactive ? handlePointerLeave : undefined}
        initial={false}
        whileHover={interactive ? { scale: 1.008 } : undefined}
        transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.6 }}
        style={{
          rotateX,
          rotateY,
          translateX,
          translateY,
          transformStyle: interactive ? "preserve-3d" : undefined,
          willChange: interactive ? "transform" : undefined,
        }}
        className="group relative"
      >
        <>{children}</>
        {interactive ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 rounded-[2.5rem] opacity-0 transition-opacity duration-150 ease-[var(--ease-editorial)] group-hover:opacity-100"
            style={{
              background: glareBackground,
            }}
          />
        ) : null}
      </motion.div>
    </div>
  );
};
