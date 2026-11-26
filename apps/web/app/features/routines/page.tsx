"use client";

import { MotionReveal } from "@/components/motion-reveal";
import { PhoneMockup, RoutinesMockup } from "@/components/phone-mockup";
import { FeatureIntro } from "@/components/feature-intro";
import { SiteCta } from "@/components/site-cta";

const points = [
  { title: "Flexible Splits", desc: "Design any routine structure that fits your schedule and goals" },
  { title: "Exercise Ordering", desc: "Reorder exercises with drag-and-drop to match your flow" },
  { title: "Targets & Notes", desc: "Set reps, sets, RPE, rest periods, and notes per exercise" },
  { title: "Start Instantly", desc: "Launch any routine into an active workout session in one tap" },
];

export default function RoutinesPage() {
  return (
    <div className="overflow-x-hidden text-cream-100 antialiased">
      <section className="container-editorial pb-12 pt-28 sm:pt-32 lg:pb-16 lg:pt-36">
        <MotionReveal>
          <FeatureIntro
            index="02"
            title="Custom Routines & Splits"
            body="Build your perfect training program. Create Push/Pull/Legs, Upper/Lower, or any custom split tailored to your goals. Start any routine instantly with all your targets pre-loaded."
            layout="split"
          />
        </MotionReveal>
      </section>

      <section className="container-editorial pb-20 lg:pb-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
          <MotionReveal className="flex justify-center lg:col-span-5 lg:justify-start" delay={0.06}>
            <div className="w-full max-w-[360px]">
              <div className="mb-5 flex items-center justify-between border-b border-hairline pb-3">
                <span className="type-label">Training</span>
                <span className="type-label">02 / 06</span>
              </div>
              <div className="flex justify-center lg:justify-start">
                <PhoneMockup>
                  <RoutinesMockup />
                </PhoneMockup>
              </div>
            </div>
          </MotionReveal>

          <MotionReveal inView className="lg:col-span-7">
            <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-2">
              {points.map((point, index) => (
                <div key={point.title} className="bg-wine-900 p-6 sm:p-8">
                  <span className="type-label">0{index + 1}</span>
                  <h2 className="type-title mt-5">{point.title}</h2>
                  <p className="type-body mt-2">{point.desc}</p>
                </div>
              ))}
            </div>
          </MotionReveal>
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
