"use client";

import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, ProgressMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Weekly Overview", desc: "Workouts, sets, volume, and time at a glance" },
  { title: "Week Comparison", desc: "See how this week stacks against last week" },
  { title: "Top PRs", desc: "Your biggest lifts all in one place" },
  { title: "Progress Trends", desc: "Data-driven insights to optimize your training" },
];

export default function ProgressPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-20 lg:pt-36">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <MotionReveal className="lg:col-span-6">
            <FeatureIntro
              index="04"
              title="Weekly Progress & Analytics"
              body="Visualize your gains with comprehensive weekly stats. Track workouts, sets, volume, and time while comparing week-over-week to optimize your training."
            />
          </MotionReveal>

          <MotionReveal className="flex justify-center lg:col-span-6 lg:justify-end" delay={0.06}>
            <div className="w-full max-w-[360px]">
              <div className="mb-5 flex items-center justify-between border-b border-hairline pb-3">
                <span className="type-label">Weekly Progress</span>
                <span className="type-label text-accent-clay">Analytics</span>
              </div>
              <div className="flex justify-center lg:justify-end">
                <PhoneMockup>
                  <ProgressMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="border-y border-hairline">
        <div className="container-editorial">
          <MotionReveal inView className="grid gap-px bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {points.map((point, index) => (
              <div key={point.title} className="bg-wine-900 px-5 py-8 lg:px-8">
                <span className="type-label">0{index + 1}</span>
                <h2 className="type-title mt-5">{point.title}</h2>
                <p className="type-body mt-2 pr-6">{point.desc}</p>
              </div>
            ))}
          </MotionReveal>
        </div>
      </section>

      <div className="pt-20 lg:pt-24">
        <SiteCta
          actions={[
            { label: "Download FitPal", href: "/#download" },
            { label: "Back to Features", href: "/#features" },
          ]}
        />
      </div>
    </div>
  );
}
