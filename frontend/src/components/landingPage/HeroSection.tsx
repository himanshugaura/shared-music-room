import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/common/Navbar";
import { Highlighter } from "@/components/ui/highlighter";

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section
      id="hero"
      className="relative w-full min-h-screen bg-[#0d1117] overflow-hidden"
      aria-label="Echo hero section"
    >
      <Navbar />

      {/* Ambient glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      </div>

      <div className="relative z-10 w-full flex flex-col md:flex-row items-center px-6 sm:px-10 md:px-14 lg:px-20 pt-28 sm:pt-32 md:pt-0 md:h-screen pb-10 md:pb-8 gap-10 md:gap-6">

        {/* Text content */}
        <div className="w-full md:w-[55%] shrink-0 flex flex-col items-center md:items-start gap-6 md:gap-7 text-center md:text-left">
          <h1 className="text-[#eceff4] font-bold leading-[1.08] tracking-tight text-4xl sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
            Never fight
            <br />
            <Highlighter action="underline" color="#a3be8c" strokeWidth={2} animationDuration={800}>
              over the aux
            </Highlighter>
            <br />
            again.
          </h1>

          <p className="text-[#6b7a8d] text-base sm:text-lg leading-relaxed max-w-[420px]">
            Echo turns any hangout, party, or shared space into a{" "}
            <Highlighter action="highlight" color="rgba(163,190,140,0.18)" strokeWidth={0} animationDuration={600}>
              <span className="text-[#d8dee9] font-medium">collaborative music room</span>
            </Highlighter>
            . Everyone votes, everyone vibes — no more aux cord wars.
          </p>

          <Link
            href="/signup"
            id="cta-get-started"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#a3be8c] hover:bg-[#8faa78] text-[#0d1117] font-semibold text-sm rounded-full transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60 cursor-pointer"
          >
            <PlayIcon />
            Start a Room
          </Link>
        </div>

        {/* Hero image — below on mobile, right on desktop */}
        <div className="flex flex-1 items-center justify-center w-full md:h-full">
          <div
            className="relative animate-float w-full max-w-[340px] sm:max-w-[420px] md:max-w-[480px]"
            style={{ filter: "drop-shadow(0 0 48px rgba(163,190,140,0.13))" }}
          >
            <Image
              src="/hero.png"
              alt="Echo — Shared Music Room collaborative playlist interface"
              width={480}
              height={480}
              priority
              quality={90}
              className="object-contain w-full h-auto"
              style={{ maxHeight: "60vh" }}
            />
          </div>
        </div>

      </div>
    </section>
  );
}
