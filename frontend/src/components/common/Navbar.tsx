
import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

export default function Navbar() {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex justify-center px-6 pt-5">
      <nav
        className="
          w-full max-w-5xl
          flex items-center justify-between
          px-5 py-3
          glass
          rounded-2xl
          border border-white/[0.07]
        "
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center gap-2 focus-visible:outline-none"
  
        >
         <span className={`${glitchFont.className} text-2xl`}>
            Echo
          </span>
         </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            id="nav-login"
            className="
              text-[#6b7a8d] hover:text-[#d8dee9]
              text-sm font-medium
              px-4 py-2 rounded-full
              transition-colors duration-150
              focus-visible:outline-none focus-visible:underline
            "
          >
            Log in
          </Link>
          <Link
            href="/signup"
            id="nav-signup"
            className="
              text-[#0f1117] bg-[#a3be8c] hover:bg-[#8faa78]
              text-sm font-semibold
              px-5 py-2 rounded-full
              transition-all duration-200
              hover:scale-[1.03] active:scale-[0.97]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60
            "
          >
            Sign up
          </Link>
        </div>
      </nav>
    </div>
  );
}
