'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function SignupPage() {
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [done, setDone] = useState(false)

    async function handleSignup(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    email: email.trim().toLowerCase(),
                    password,
                }),
            })

            const json = await res.json()

            if (!res.ok) {
                if (res.status === 409) {
                    setError('already_exists')
                } else {
                    setError(json.error || 'Something went wrong.')
                }
                return
            }

            setDone(true)
        } catch {
            setError('Network error — please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center px-4 py-8">
            {/* Dot grid texture */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.04] [background-image:radial-gradient(circle,#000_1px,transparent_1px)] [background-size:24px_24px]" />

            <div className="w-full max-w-[420px] fade-up">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5 justify-center mb-10 no-underline group">
                    <div className="w-9 h-9 bg-[#3730a3] rounded-xl flex items-center justify-center shadow-sm group-hover:bg-[#312e81] transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </div>
                    <span
                        className="text-[#1a1a18] font-bold text-xl tracking-tight"
                        style={{ fontFamily: "'Outfit', sans-serif" }}
                    >
            360<span className="text-[#3730a3]">Editor</span>
          </span>
                </Link>

                <div className="bg-white rounded-2xl border border-[#E2E2DA] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                    <div className="mb-7">
                        <h1
                            className="text-2xl font-semibold text-[#1a1a18] mb-1.5"
                            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                        >
                            Create your account
                        </h1>
                        <p className="text-[#6b6b60] text-sm">Start building 360° virtual tours today</p>
                    </div>

                    {/* ── Email confirmation sent ── */}
                    {done ? (
                        <div className="bg-[#3730a3]/5 border border-[#3730a3]/20 rounded-xl p-5 text-center">
                            <div className="text-3xl mb-3">📬</div>
                            <p className="font-semibold text-[#1a1a18] mb-1.5">Check your inbox</p>
                            <p className="text-[13px] text-[#6b6b60] leading-relaxed mb-4">
                                We sent a confirmation link to{' '}
                                <strong className="text-[#1a1a18]">{email}</strong>. Click it to activate your
                                account, then log in.
                            </p>
                            <Button asChild className="bg-[#3730a3] hover:bg-[#312e81] text-white text-sm h-9 px-5">
                                <Link href="/login">Go to login →</Link>
                            </Button>
                        </div>
                    ) : (
                        /* ── Sign-up form ── */
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label htmlFor="firstName" className="text-[13px] font-medium text-[#1a1a18]">
                                        First name
                                    </Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="Jane"
                                        required
                                        className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="lastName" className="text-[13px] font-medium text-[#1a1a18]">
                                        Last name
                                    </Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Doe"
                                        className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-[13px] font-medium text-[#1a1a18]">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="password" className="text-[13px] font-medium text-[#1a1a18]">
                                    Password
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Min 8 characters"
                                    minLength={8}
                                    className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]"
                                />
                            </div>

                            {/* ── Error states ── */}
                            {error === 'already_exists' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-2.5">
                                    <svg
                                        width="15"
                                        height="15"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="#d97706"
                                        strokeWidth="2"
                                        className="mt-0.5 flex-shrink-0"
                                    >
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <p className="text-[13px] text-amber-800">
                                        An account with this email already exists.{' '}
                                        <Link
                                            href="/login"
                                            className="font-semibold text-[#3730a3] no-underline hover:underline"
                                        >
                                            Try logging in →
                                        </Link>
                                    </p>
                                </div>
                            )}

                            {error && error !== 'already_exists' && (
                                <Alert variant="destructive" className="border-red-200 bg-red-50 py-2.5">
                                    <AlertDescription className="text-red-700 text-[13px]">{error}</AlertDescription>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-10 bg-[#3730a3] hover:bg-[#312e81] text-white font-semibold text-[14px] rounded-lg transition-colors"
                            >
                                {loading ? (
                                    <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                      />
                      <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Creating account…
                  </span>
                                ) : (
                                    'Create account'
                                )}
                            </Button>
                        </form>
                    )}

                    <div className="mt-6 pt-5 border-t border-[#E2E2DA] text-center">
                        <p className="text-[13px] text-[#6b6b60]">
                            Already have an account?{' '}
                            <Link
                                href="/login"
                                className="text-[#3730a3] font-semibold no-underline hover:text-[#312e81] transition-colors"
                            >
                                Sign in →
                            </Link>
                        </p>
                    </div>
                </div>

                <p className="text-center text-[11px] text-[#6b6b60]/60 mt-5">
                    By creating an account you agree to our Terms of Service and Privacy Policy.
                </p>
            </div>
        </div>
    )
}