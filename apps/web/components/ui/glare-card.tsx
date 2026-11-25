"use client";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef } from "react";
import { useFinePointer, usePrefersReducedMotion } from "@/lib/motion-environment";

export const GlareCard = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const finePointer = useFinePointer();
  const reduceMotion = usePrefersReducedMotion();
  const interactive = finePointer && !reduceMotion;
  const isPointerInside = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refElement = useRef<HTMLDivElement>(null);
  const state = useRef({
    glare: {
      x: 50,
      y: 50,
    },
    background: {
      x: 50,
      y: 50,
    },
    rotate: {
      x: 0,
      y: 0,
    },
  });
  const containerStyle = {
    "--m-x": "50%",
    "--m-y": "50%",
    "--r-x": "0deg",
    "--r-y": "0deg",
    "--bg-x": "50%",
    "--bg-y": "50%",
    "--duration": "180ms",
    "--foil-size": "100%",
    "--opacity": "0",
    "--radius": "12px",
    "--easing": "cubic-bezier(0.22, 1, 0.36, 1)",
    "--transition": "var(--duration) var(--easing)",
  } as React.CSSProperties;

  const backgroundStyle = {
    "--step": "5%",
    "--foil-svg": `url("data:image/svg+xml,%3Csvg width='26' height='26' viewBox='0 0 26 26' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.99994 3.419C2.99994 3.419 21.6142 7.43646 22.7921 12.153C23.97 16.8695 3.41838 23.0306 3.41838 23.0306' stroke='white' stroke-width='5' stroke-miterlimit='3.86874' stroke-linecap='round' style='mix-blend-mode:darken'/%3E%3C/svg%3E")`,
    "--pattern": "var(--foil-svg) center/100% no-repeat",
    "--foil":
      "repeating-linear-gradient( 0deg,#713047 calc(var(--step) * 1),#C9795A calc(var(--step) * 2),#5C1B2D calc(var(--step) * 3),#713047 calc(var(--step) * 4),#C9795A calc(var(--step) * 5),#D9BE8A calc(var(--step) * 6),#5C1B2D calc(var(--step) * 7) ) 0% var(--bg-y)/200% 700% no-repeat",
    "--diagonal":
      "repeating-linear-gradient( 128deg,#1B050C 0%,rgba(201,121,90,0.12) 3.8%,rgba(201,121,90,0.12) 4.5%,rgba(201,121,90,0.12) 5.2%,#1B050C 10%,#1B050C 12% ) var(--bg-x) var(--bg-y)/300% no-repeat",
    "--shade":
      "radial-gradient( farthest-corner circle at var(--m-x) var(--m-y),rgba(201,121,90,0.22) 12%,rgba(217,190,138,0.14) 20%,rgba(201,121,90,0) 120% ) var(--bg-x) var(--bg-y)/300% no-repeat",
    backgroundBlendMode: "hue, hue, hue, overlay",
  };

  const resetPointerState = useCallback(() => {
    isPointerInside.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (refElement.current) {
      refElement.current.style.removeProperty("--duration");
      refElement.current.style.setProperty("--r-x", "0deg");
      refElement.current.style.setProperty("--r-y", "0deg");
    }
  }, []);

  useEffect(() => {
    if (!interactive) resetPointerState();
  }, [interactive, resetPointerState]);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const updateStyles = () => {
    if (!refElement.current) return;
    const { background, rotate, glare } = state.current;
    refElement.current.style.setProperty("--m-x", `${glare.x}%`);
    refElement.current.style.setProperty("--m-y", `${glare.y}%`);
    refElement.current.style.setProperty("--r-x", `${rotate.x}deg`);
    refElement.current.style.setProperty("--r-y", `${rotate.y}deg`);
    refElement.current.style.setProperty("--bg-x", `${background.x}%`);
    refElement.current.style.setProperty("--bg-y", `${background.y}%`);
  };

  return (
    <div
      style={containerStyle}
      className="relative isolate [aspect-ratio:16/10] h-full w-full min-h-[220px] transition-transform duration-[var(--duration)] ease-[var(--easing)] will-change-transform [contain:layout_style] [perspective:600px]"
      ref={refElement}
      onPointerMove={(event) => {
        if (!interactive) return;
        const rotateFactor = 0.2;
        const rect = event.currentTarget.getBoundingClientRect();
        const percentage = {
          x: (100 / rect.width) * (event.clientX - rect.left),
          y: (100 / rect.height) * (event.clientY - rect.top),
        };
        const delta = {
          x: percentage.x - 50,
          y: percentage.y - 50,
        };

        const { background, rotate, glare } = state.current;
        background.x = 50 + percentage.x / 4 - 12.5;
        background.y = 50 + percentage.y / 3 - 16.67;
        rotate.x = -(delta.x / 3.5) * rotateFactor;
        rotate.y = (delta.y / 2) * rotateFactor;
        glare.x = percentage.x;
        glare.y = percentage.y;

        updateStyles();
      }}
      onPointerEnter={() => {
        if (!interactive) return;
        isPointerInside.current = true;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (isPointerInside.current) {
            refElement.current?.style.setProperty("--duration", "0s");
          }
        }, 180);
      }}
      onPointerLeave={resetPointerState}
    >
      <div className="grid h-full origin-center [transform:rotateY(var(--r-x))_rotateX(var(--r-y))] overflow-hidden rounded-[var(--radius)] border border-border transition-transform duration-[var(--duration)] ease-[var(--easing)] will-change-transform hover:filter-none hover:[--duration:200ms] hover:[--easing:linear] hover:[--opacity:0.35]">
        <div className="grid h-full w-full mix-blend-soft-light [clip-path:inset(0_0_0_0_round_var(--radius))] [grid-area:1/1]">
          <div className={cn("h-full w-full bg-wine-950", className)}>
            {children}
          </div>
        </div>
        <div className="will-change-background grid h-full w-full opacity-[var(--opacity)] mix-blend-soft-light transition-opacity duration-[var(--duration)] ease-[var(--easing)] [background:radial-gradient(farthest-corner_circle_at_var(--m-x)_var(--m-y),_rgba(201,121,90,0.28)_10%,_rgba(217,190,138,0.16)_20%,_rgba(201,121,90,0)_90%)] [clip-path:inset(0_0_1px_0_round_var(--radius))] [grid-area:1/1]" />
        <div
          className="will-change-background after:grid-area-[inherit] after:bg-repeat-[inherit] after:bg-attachment-[inherit] after:bg-origin-[inherit] after:bg-clip-[inherit] relative grid h-full w-full opacity-[var(--opacity)] [background-blend-mode:hue_hue_hue_overlay] mix-blend-color-dodge transition-opacity [background:var(--pattern),_var(--foil),_var(--diagonal),_var(--shade)] [clip-path:inset(0_0_1px_0_round_var(--radius))] [grid-area:1/1] after:bg-[inherit] after:[background-size:var(--foil-size),_200%_400%,_800%,_200%] after:[background-position:center,_0%_var(--bg-y),_calc(var(--bg-x)*_-1)_calc(var(--bg-y)*_-1),_var(--bg-x)_var(--bg-y)] after:[background-blend-mode:soft-light,_hue,_hard-light] after:mix-blend-exclusion after:content-['']"
          style={{ ...backgroundStyle }}
        />
      </div>
    </div>
  );
};
