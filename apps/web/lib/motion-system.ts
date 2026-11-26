"use client";

import type { Transition, Variants } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion-environment";

export const editorialEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

function variantsFor(
  reduce: boolean,
  distance: number,
  duration: number,
  scale = false,
): Variants {
  return {
    hidden: {
      opacity: reduce ? 1 : 0,
      y: reduce ? 0 : distance,
      ...(scale ? { scale: reduce ? 1 : 0.96 } : {}),
    },
    visible: {
      opacity: 1,
      y: 0,
      ...(scale ? { scale: 1 } : {}),
      transition: { duration: reduce ? 0 : duration, ease: editorialEase },
    },
  };
}

export function useEditorialMotion() {
  const reduce = usePrefersReducedMotion();

  const transition: Transition = {
    duration: reduce ? 0 : 0.16,
    ease: editorialEase,
  };

  const introWithDelay = (delay: number): Variants => {
    const base = variantsFor(reduce, 14, 0.5);
    if (!delay || reduce) return base;
    return {
      ...base,
      visible: {
        ...(base.visible as Record<string, unknown>),
        transition: { duration: 0.5, delay, ease: editorialEase },
      },
    };
  };

  return {
    reduce,
    transition,
    intro: variantsFor(reduce, 14, 0.5),
    introWithDelay,
    section: variantsFor(reduce, 12, 0.44),
    preview: variantsFor(reduce, 8, 0.32),
    item: variantsFor(reduce, 10, 0.36),
    status: variantsFor(reduce, 6, 0.28, true),
    indicator: {
      hidden: { opacity: reduce ? 1 : 0, scaleX: reduce ? 1 : 0 },
      visible: {
        opacity: 1,
        scaleX: 1,
        transition: { duration: reduce ? 0 : 0.18, ease: editorialEase },
      },
    } satisfies Variants,
    stagger: {
      hidden: {},
      visible: {
        transition: {
          delayChildren: reduce ? 0 : 0.04,
          staggerChildren: reduce ? 0 : 0.06,
        },
      },
    } satisfies Variants,
    viewport: { once: true, amount: 0.15 } as const,
  };
}
