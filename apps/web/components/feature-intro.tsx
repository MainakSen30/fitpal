"use client";

import { motion } from "framer-motion";
import { useEditorialMotion } from "@/lib/motion-system";

type FeatureIntroProps = {
  index: string;
  title: string;
  body: string;
  layout?: "stacked" | "split" | "centered";
};

function Eyebrow({
  index,
  centered = false,
  variants,
}: {
  index: string;
  centered?: boolean;
  variants: ReturnType<typeof useEditorialMotion>["item"];
}) {
  return (
    <motion.div data-motion-reveal variants={variants} className={`type-eyebrow ${centered ? "justify-center" : ""}`}>
      <span>Feature</span>
      <span aria-hidden="true">/</span>
      <span>{index}</span>
    </motion.div>
  );
}

export function FeatureIntro({ index, title, body, layout = "stacked" }: FeatureIntroProps) {
  const { item, stagger } = useEditorialMotion();

  if (layout === "split") {
    return (
      <motion.div variants={stagger} initial="hidden" animate="visible" className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-16">
        <div className="lg:col-span-7">
          <Eyebrow index={index} variants={item} />
          <motion.h1 data-motion-reveal variants={item} className="type-display mt-5">{title}</motion.h1>
        </div>
        <motion.p data-motion-reveal variants={item} className="type-body-lg max-w-md lg:col-span-5 lg:pb-2">{body}</motion.p>
      </motion.div>
    );
  }

  if (layout === "centered") {
    return (
      <motion.div variants={stagger} initial="hidden" animate="visible" className="text-center">
        <Eyebrow index={index} centered variants={item} />
        <motion.h1 data-motion-reveal variants={item} className="type-display mx-auto mt-5 max-w-3xl">{title}</motion.h1>
        <motion.p data-motion-reveal variants={item} className="type-body-lg mx-auto mt-6 max-w-xl">{body}</motion.p>
      </motion.div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible">
      <Eyebrow index={index} variants={item} />
      <motion.h1 data-motion-reveal variants={item} className="type-display mt-5 max-w-xl">{title}</motion.h1>
      <motion.p data-motion-reveal variants={item} className="type-body-lg mt-6 max-w-xl">{body}</motion.p>
    </motion.div>
  );
}
