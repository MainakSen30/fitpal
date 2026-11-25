"use client";

import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, LogbookMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Full History", desc: "Access every workout you've ever logged in one place" },
  { title: "Detailed Breakdown", desc: "See all exercises, sets, weights, reps, and notes" },
  { title: "Edit or Delete", desc: "Fix mistakes or remove old sessions anytime" },
  { title: "Automatic PR Tracking", desc: "Personal records detected and celebrated automatically" },
];

export default function LogbookPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <MotionReveal className="lg:col-span-7">
            <FeatureIntro
              index="03"
              title="Complete Logbook & PRs"
              body="Every workout saved forever. Browse your complete history, review past sessions in detail with full exercise breakdowns, and track all your personal records as they happen."
            />
          </MotionReveal>

          <MotionReveal className="lg:col-span-5 lg:sticky lg:top-24" delay={0.06}>
            <div className="mx-auto w-full max-w-[360px]">
              <div className="mb-5 flex items-center justify-between border-b border-hairline pb-3">
                <span className="type-label">History</span>
                <span className="type-label">03 / 06</span>
              </div>
              <div className="flex justify-center lg:justify-end">
                <PhoneMockup>
                  <LogbookMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="container-editorial pb-20 lg:pb-24">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-8">
            <span className="type-label text-cream-200">Logbook</span>
          </div>
          {points.map((point, index) => (
            <div
              key={point.title}
              className="grid gap-2 border-b border-hairline px-5 py-5 last:border-b-0 sm:grid-cols-[3.5rem_14rem_1fr] sm:items-baseline sm:gap-6 sm:px-8"
            >
              <span className="type-label">0{index + 1}</span>
              <h2 className="type-title">{point.title}</h2>
              <p className="type-body">{point.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteCta
        actions={[
          { label: "Download FitPal", href: "/#download" },
          { label: "Back to Features", href: "/#features" },
        ]}
      />
    </div>
  );
}
