"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Shield, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-lurk-950 via-surface to-surface-50 flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-lurk-600/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-lurk-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-purple-600/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-md text-center">
          <div className="w-16 h-16 rounded-2xl bg-lurk-600 flex items-center justify-center mx-auto mb-8 shadow-glow">
            <Eye className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">
            Lurk Admin Console
          </h1>
          <p className="text-base text-gray-400 mb-10">
            Enterprise knowledge management, artifact governance, and AI agent orchestration.
          </p>

          <div className="space-y-4 text-left">
            {[
              {
                icon: <Shield className="w-4 h-4 text-lurk-400" />,
                title: "Policy-Driven Governance",
                description: "Configure privacy, redaction, and access policies for your entire organization.",
              },
              {
                icon: <Eye className="w-4 h-4 text-lurk-400" />,
                title: "AI Agent Orchestration",
                description: "Deploy, monitor, and control knowledge agents from a single interface.",
              },
              {
                icon: <Lock className="w-4 h-4 text-lurk-400" />,
                title: "Enterprise Security",
                description: "Kill switches, audit trails, and compliance monitoring built-in.",
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 rounded-xl bg-surface-100/30 backdrop-blur-sm border border-gray-800/30"
              >
                <div className="w-8 h-8 rounded-lg bg-lurk-600/20 flex items-center justify-center shrink-0 mt-0.5">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl bg-lurk-600 flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-100">Lurk</span>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-100 tracking-tight">
              Welcome back
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Sign in to your admin console
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            Continue with Google
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800/60" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-surface text-gray-600">or</span>
            </div>
          </div>

          {/* Email fallback */}
          <div className="space-y-3">
            <div>
              <input
                type="email"
                placeholder="Email address"
                className="input-base w-full"
                disabled
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                className="input-base w-full"
                disabled
              />
            </div>
            <Button fullWidth variant="secondary" disabled>
              Email sign-in coming soon
            </Button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-2xs text-gray-600">
              By signing in, you agree to the Lurk{" "}
              <a href="#" className="text-lurk-400 hover:text-lurk-300 transition-colors">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-lurk-400 hover:text-lurk-300 transition-colors">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
