"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion-environment";

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const TextGenerateEffect = ({
  words,
  className,
  duration = 0.2,
}: {
  words: string;
  className?: string;
  duration?: number;
}) => {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div className={cn("font-normal", className)}>
      <div className="mt-4">
        <motion.div
          data-motion-reveal
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: reduceMotion ? 0 : Math.min(duration, 0.2),
            ease: easeOut,
          }}
          className="text-cream-100 text-base sm:text-lg leading-relaxed tracking-wide"
        >
          {words}
        </motion.div>
      </div>
    </div>
  );
};
