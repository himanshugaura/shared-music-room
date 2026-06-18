"use client";

import Link from "next/link";
import { Rubik_Glitch } from "next/font/google";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GoogleOAuthButton from "@/components/auth/GoogleLoginButton";
import { useRegister, checkUsernameAvailable } from "@/hooks/useAuth";

const glitchFont = Rubik_Glitch({
  subsets: ["latin"],
  variable: "--font-glitch",
  weight: "400",
});

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function FieldError({ message, id }: { message: string; id?: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-xs mt-1" role="alert" aria-live="polite" style={{ color: "#bf616a" }}>
      <ErrorIcon />
      {message}
    </p>
  );
}

type PasswordStrength = "weak" | "fair" | "strong" | "none";

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return "none";
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return "weak";
  if (score === 2 || score === 3) return "fair";
  return "strong";
}

const strengthConfig = {
  none: { bars: 0, color: "transparent", label: "" },
  weak: { bars: 1, color: "#bf616a", label: "Weak" },
  fair: { bars: 2, color: "#d08770", label: "Fair" },
  strong: { bars: 3, color: "#a3be8c", label: "Strong" },
};

function validateName(value: string): string {
  if (!value.trim()) return "Name is required";
  if (value.trim().length > 100) return "Name is too long";
  return "";
}

function validateUsername(value: string): string {
  if (!value.trim()) return "Username is required";
  if (value.length < 3) return "Username must be at least 3 characters";
  if (value.length > 30) return "Username must be at most 30 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return "Only letters, numbers and underscores";
  return "";
}

function validatePassword(value: string): string {
  if (!value) return "Password is required";
  if (value.length < 8) return "Password must be at least 8 characters";
  return "";
}

function validateConfirm(value: string, password: string): string {
  if (!value) return "Please confirm your password";
  if (value !== password) return "Passwords don't match";
  return "";
}

type Fields = "name" | "username" | "password" | "confirm";
type TouchedMap = Partial<Record<Fields, boolean>>;

export default function SignupPage() {
  const router = useRouter();
  const { mutate: registerMutate, isPending } = useRegister();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [focused, setFocused] = useState<string | null>(null);
  const [touched, setTouched] = useState<TouchedMap>({});

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameCheckError, setUsernameCheckError] = useState("");

  useEffect(() => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameAvailable(null);
      setUsernameCheckError("");
      return;
    }

    const err = validateUsername(trimmed);
    if (err) {
      setUsernameAvailable(false);
      setUsernameCheckError("");
      return;
    }

    setCheckingUsername(true);
    setUsernameAvailable(null);
    setUsernameCheckError("");

    const timeoutId = setTimeout(async () => {
      const { available, message } = await checkUsernameAvailable(trimmed);
      setUsernameAvailable(available);
      setUsernameCheckError(available ? "" : message);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username]);

  const strength = getPasswordStrength(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;

  const nameError = touched.name ? validateName(name) : "";
  const usernameError = touched.username ? (validateUsername(username) || usernameCheckError) : "";
  const passwordError = touched.password ? validatePassword(password) : "";
  const confirmError = touched.confirm ? validateConfirm(confirm, password) : "";

  function handleBlur(field: Fields) {
    setTouched(prev => ({ ...prev, [field]: true }));
    setFocused(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, username: true, password: true, confirm: true });

    const nErr = validateName(name);
    const uErr = validateUsername(username);
    const pErr = validatePassword(password);
    const cErr = validateConfirm(confirm, password);

    if (nErr || uErr || pErr || cErr || usernameAvailable === false) return;

    registerMutate(
      { name: name.trim(), username: username.trim(), password },
      {
        onSuccess: (user) => {
          if (!user?.username) {
            router.replace("/profile");
          } else {
            router.replace("/dashboard");
          }
        },
      }
    );
  }

  function getFieldStyle(field: Fields, extraMatch?: boolean) {
    let error = "";
    if (field === "name") error = nameError;
    else if (field === "username") error = usernameError;
    else if (field === "password") error = passwordError;
    else if (field === "confirm") error = confirmError;

    const isFocused = focused === field;

    if (error) {
      return {
        border: "1px solid rgba(191,97,106,0.6)",
        boxShadow: isFocused ? "0 0 0 3px rgba(191,97,106,0.1)" : "0 0 0 3px rgba(191,97,106,0.06)",
      };
    }
    if (extraMatch) {
      return { border: "1px solid rgba(163,190,140,0.4)", boxShadow: "none" };
    }
    return {
      border: isFocused ? "1px solid rgba(163,190,140,0.5)" : "1px solid rgba(255,255,255,0.08)",
      boxShadow: isFocused ? "0 0 0 3px rgba(163,190,140,0.08)" : "none",
    };
  }

  return (
    <main className="relative min-h-screen w-full bg-[#0d1117] flex items-center justify-center overflow-hidden py-10">

      {/* Ambient glow blobs */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{ position: "absolute", top: "-5%", right: "10%", width: "520px", height: "520px", background: "radial-gradient(ellipse at center, rgba(163,190,140,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "8%", width: "400px", height: "400px", background: "radial-gradient(ellipse at center, rgba(143,188,187,0.06) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* Back to home */}
      <Link href="/" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-[#6b7a8d] hover:text-[#d8dee9] text-sm transition-colors duration-150 focus-visible:outline-none" id="back-to-home" aria-label="Back to home">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back
      </Link>

      {/* Card */}
      <div className="auth-card relative z-10 w-full max-w-md mx-4" style={{ background: "rgba(22,27,34,0.75)", backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", padding: "40px 36px 36px", boxShadow: "0 0 0 1px rgba(163,190,140,0.04), 0 32px 64px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)" }}>

        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <Link href="/" className="focus-visible:outline-none" tabIndex={-1} aria-hidden="true">
            <span className={`${glitchFont.className} text-3xl text-[#eceff4] tracking-wide`}>Echo</span>
          </Link>
        </div>

        <h1 className="text-[#eceff4] text-2xl font-bold text-center mb-1 tracking-tight">Create your account</h1>
        <p className="text-[#6b7a8d] text-sm text-center mb-7">Join Echo and start listening together</p>

        <GoogleOAuthButton />

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-white/[0.07]" />
          <span className="text-[#6b7a8d] text-xs">or</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-name" className="text-[#d8dee9] text-xs font-medium tracking-wide">Display Name</label>
            <div className="relative rounded-xl transition-all duration-200" style={{ background: "rgba(255,255,255,0.04)", ...getFieldStyle("name") }}>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                onFocus={() => setFocused("name")}
                onBlur={() => handleBlur("name")}
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "signup-name-error" : undefined}
                className="w-full bg-transparent px-4 py-3 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none rounded-xl"
              />
            </div>
            {nameError && <FieldError id="signup-name-error" message={nameError} />}
          </div>

          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-username" className="text-[#d8dee9] text-xs font-medium tracking-wide">Username</label>
            <div className="relative rounded-xl transition-all duration-200 flex items-center" style={{ background: "rgba(255,255,255,0.04)", ...getFieldStyle("username") }}>
              <span className="pl-4 pr-1 text-[#6b7a8d] text-sm select-none" aria-hidden="true">@</span>
              <input
                id="signup-username"
                type="text"
                autoComplete="username"
                placeholder="yourhandle"
                value={username}
                onChange={e => setUsername(e.target.value.replace(/\s/g, ""))}
                onFocus={() => setFocused("username")}
                onBlur={() => handleBlur("username")}
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? "signup-username-error" : undefined}
                className="flex-1 bg-transparent pr-10 py-3 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none"
              />
              {username.length >= 3 && (
                <div className="absolute right-4 flex items-center">
                  {checkingUsername ? (
                    <svg className="animate-spin text-[#6b7a8d]" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M12 2A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  ) : usernameAvailable ? (
                    <span className="text-[#a3be8c]"><CheckIcon /></span>
                  ) : usernameAvailable === false && !validateUsername(username) ? (
                    <span className="text-[#bf616a]"><ErrorIcon /></span>
                  ) : null}
                </div>
              )}
            </div>
            {usernameError && <FieldError id="signup-username-error" message={usernameError} />}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-password" className="text-[#d8dee9] text-xs font-medium tracking-wide">Password</label>
            <div className="relative rounded-xl transition-all duration-200" style={{ background: "rgba(255,255,255,0.04)", ...getFieldStyle("password") }}>
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onFocus={() => setFocused("password")}
                onBlur={() => handleBlur("password")}
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "signup-password-error" : undefined}
                className="w-full bg-transparent px-4 py-3 pr-12 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none rounded-xl"
              />
              <button type="button" id="toggle-password-visibility" onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a8d] hover:text-[#d8dee9] transition-colors duration-150 cursor-pointer focus-visible:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {/* Password strength meter */}
            {password.length > 0 && (
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex gap-1 flex-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{ background: i < strengthConfig[strength].bars ? strengthConfig[strength].color : "rgba(255,255,255,0.08)" }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium transition-colors duration-200" style={{ color: strengthConfig[strength].color }}>
                  {strengthConfig[strength].label}
                </span>
              </div>
            )}
            {passwordError && <FieldError id="signup-password-error" message={passwordError} />}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="signup-confirm-password" className="text-[#d8dee9] text-xs font-medium tracking-wide">Confirm Password</label>
            <div className="relative rounded-xl transition-all duration-200" style={{ background: "rgba(255,255,255,0.04)", ...getFieldStyle("confirm", passwordsMatch) }}>
              <input
                id="signup-confirm-password"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onFocus={() => setFocused("confirm")}
                onBlur={() => handleBlur("confirm")}
                aria-invalid={!!confirmError}
                aria-describedby={confirmError ? "signup-confirm-error" : undefined}
                className="w-full bg-transparent px-4 py-3 pr-12 text-[#eceff4] text-sm placeholder-[#6b7a8d]/60 focus:outline-none rounded-xl"
              />
              <button type="button" id="toggle-confirm-visibility" onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7a8d] hover:text-[#d8dee9] transition-colors duration-150 cursor-pointer focus-visible:outline-none"
                aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}>
                {passwordsMatch ? (
                  <span className="text-[#a3be8c]"><CheckIcon /></span>
                ) : (
                  <EyeIcon open={showConfirm} />
                )}
              </button>
            </div>
            {confirmError && <FieldError id="signup-confirm-error" message={confirmError} />}
          </div>

          {/* Submit */}
          <button
            id="signup-submit"
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl text-[#0f1117] text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a3be8c]/60 mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(135deg, #a3be8c 0%, #8faa78 100%)" }}
            onMouseEnter={e => { if (isPending) return; (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(163,190,140,0.25)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
            onMouseDown={e => { if (isPending) return; (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.975)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.015)"; }}
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.2)" strokeWidth="3" />
                  <path d="M12 2 A10 10 0 0 1 22 12" stroke="#0f1117" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Creating account…
              </span>
            ) : "Create account"}
          </button>
        </form>

        {/* Login link */}
        <p className="text-center text-[#6b7a8d] text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" id="goto-login" className="text-[#a3be8c] hover:text-[#8faa78] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
