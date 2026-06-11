import type { Metadata } from "next";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Echo — Shared Music Room",
  description:
    "Echo lets everyone in the room queue songs together. No more aux cord wars — one collaborative playlist, zero conflicts.",
  keywords: ["shared music", "collaborative playlist", "music room", "echo"],
  openGraph: {
    title: "Echo — Shared Music Room",
    description: "Never fight over the aux again.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", inter.variable, "font-sans", geist.variable)}>
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
