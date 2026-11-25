import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logbook and PRs",
  description: "Browse your complete workout history, review past sessions in detail, and track personal records as they happen.",
};

export default function LogbookLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
