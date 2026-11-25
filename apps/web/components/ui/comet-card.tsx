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

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
    [`${tiltDepth}deg`, `-${tiltDepth}deg`],
  );

  const translateX = useTransform(
    mouseXSpring,
    [-0.5, 0.5],
    [`-${shiftDepth}px`, `${shiftDepth}px`],
  );
  const translateY = useTransform(
    mouseYSpring,
    [-0.5, 0.5],
    [`${shiftDepth}px`, `-${shiftDepth}px`],
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

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const xPct = (event.clientX - rect.left) / rect.width - 0.5;
    const yPct = (event.clientY - rect.top) / rect.height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div className={cn("perspective-distant transform-3d", className)}>
      <motion.div
        ref={ref}
        onMouseMove={interactive ? handleMouseMove : undefined}
        onMouseLeave={interactive ? handleMouseLeave : undefined}
        initial={false}
        whileHover={interactive ? { scale: 1.01 } : undefined}
        transition={{ duration: 0.18, ease: easeOut }}
        style={{
          rotateX,
          rotateY,
          translateX,
          translateY,
          overflow: "hidden",
        }}
        className="relative rounded-card"
      >
        <>{children}</>
        <motion.div
          className="pointer-events-none absolute inset-0 z-50 h-full w-full rounded-[16px]"
          style={{
            background: glareBackground,
          }}
        />
      </motion.div>
    </div>
  );
};
