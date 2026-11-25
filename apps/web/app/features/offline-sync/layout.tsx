import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline Sync",
  description: "Log a full workout offline and sync automatically when your connection returns, so you never miss a rep.",
};

export default function OfflineSyncLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
