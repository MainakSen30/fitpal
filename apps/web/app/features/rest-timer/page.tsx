"use client";

import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, RestTimerMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Auto-Start", desc: "Timer starts automatically after logging a set" },
  { title: "Custom Durations", desc: "Set different rest times per exercise" },
  { title: "Quick Adjust", desc: "Add or subtract time with one tap" },
  { title: "Haptic Alerts", desc: "Gentle vibration when rest is complete" },
];

function PointList({ items, start }: { items: typeof points; start: number }) {
  return (
    <MotionReveal inView className="border-t border-hairline">
      {items.map((point, index) => (
        <div key={point.title} className="border-b border-hairline py-6">
          <span className="type-label">0{start + index}</span>
          <h2 className="type-title mt-4">{point.title}</h2>
          <p className="type-body mt-2">{point.desc}</p>
        </div>
      ))}
    </MotionReveal>
  );
}

export default function RestTimerPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-16 pt-28 sm:pt-32 lg:pb-24 lg:pt-36">
        <MotionReveal className="mx-auto max-w-4xl">
          <FeatureIntro
            index="05"
            title="Smart Rest Timer"
            body="Stay on track with automatic rest countdowns. Get notified when you're ready for your next set so you maximize efficiency and recovery between sets."
            layout="centered"
          />
        </MotionReveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-10 lg:mt-20 lg:grid-cols-[1fr_minmax(0,320px)_1fr] lg:items-center lg:gap-12">
          <div className="order-2 lg:order-1">
            <PointList items={points.slice(0, 2)} start={1} />
          </div>

          <MotionReveal className="order-1 flex justify-center lg:order-2" delay={0.06}>
            <div className="w-full max-w-[360px]">
              <div className="mb-5 flex items-center justify-between border-b border-hairline pb-3">
                <span className="type-label">Rest Time</span>
                <span className="type-label">05 / 06</span>
              </div>
              <div className="flex justify-center">
                <PhoneMockup>
                  <RestTimerMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>

          <div className="order-3">
            <PointList items={points.slice(2)} start={3} />
          </div>
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
