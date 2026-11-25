"use client";

import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, WorkoutLoggingMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Instant Start", desc: "Begin an empty session or load a routine in one tap" },
  { title: "Smart Auto-Fill", desc: "Previous weights and reps pre-populated for each exercise automatically" },
  { title: "PR Detection", desc: "Instantly celebrate when you hit a personal record" },
  { title: "Optimized for Speed", desc: "Designed for one-handed use between sets in the gym" },
];

export default function WorkoutLoggingPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <MotionReveal className="lg:col-span-6">
            <FeatureIntro
              index="01"
              title="Quick Workout Logging"
              body="Log sets, reps, and weights faster than ever. Start from scratch or from a routine, track your progress set by set, and hit new PRs with intelligent auto-fill and instant PR detection."
            />
          </MotionReveal>

          <MotionReveal className="flex justify-center lg:col-span-6 lg:justify-end" delay={0.06}>
            <div className="w-full max-w-[360px]">
              <div className="mb-5 hidden items-center justify-between border-b border-hairline pb-3 lg:flex">
                <span className="type-label">Current Session</span>
                <span className="type-label">01 / 06</span>
              </div>
              <div className="flex justify-center lg:justify-end">
                <PhoneMockup>
                  <WorkoutLoggingMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="container-editorial pb-20 lg:pb-24">
        <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
          {points.map((point, index) => (
            <div key={point.title} className="bg-wine-900 p-6 sm:p-8 lg:p-10">
              <span className="type-label">0{index + 1}</span>
              <h2 className="type-title mt-5">{point.title}</h2>
              <p className="type-body mt-2 max-w-sm">{point.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteCta
        actions={[
          { label: "Download for iOS", href: "/#download" },
          { label: "Download for Android", href: "/#download" },
        ]}
      />
    </div>
  );
}
