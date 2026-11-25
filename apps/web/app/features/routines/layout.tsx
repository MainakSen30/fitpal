import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Custom Routines",
  description: "Build Push/Pull/Legs, Upper/Lower, or a custom split with exercise order, targets, notes, and rest periods.",
};

export default function RoutinesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
