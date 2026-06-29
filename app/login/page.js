'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleLogin(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                }),
            })

            const json = await res.json()

            if (!res.ok) {
                setError(json.error || 'Invalid email or password.')
                return
            }

            router.push('/360editor')
            router.refresh()
        } catch {
            setError('Network error — please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center px-4">
            {/* Background texture */}
            <div
                className="fixed inset-0 pointer-events-none opacity-[0.025]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
                }}
            />

            <div className="w-full max-w-[400px] fade-up">
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

                {/* Card */}
                <div className="bg-white rounded-2xl border border-[#E2E2DA] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                    <div className="mb-7">
                        <h1
                            className="text-2xl font-semibold text-[#1a1a18] mb-1.5"
                            style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                        >
                            Welcome back
                        </h1>
                        <p className="text-[#6b6b60] text-sm">Sign in to continue to your projects</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
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
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-[13px] font-medium text-[#1a1a18]">Password</Label>
                                <Link href="/forgot_password" className="text-[12px] text-[#3730a3] font-medium hover:text-[#312e81] no-underline transition-colors">Forgot password?</Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                                className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]"
                            />
                        </div>

                        {error && (
                            <Alert variant="destructive" className="border-red-200 bg-red-50 py-2.5">
                                <AlertDescription className="text-red-700 text-[13px]">{error}</AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10 bg-[#3730a3] hover:bg-[#312e81] text-white font-semibold text-[14px] rounded-lg transition-colors mt-1"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Signing in…
                </span>
                            ) : (
                                'Sign in'
                            )}
                        </Button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-[#E2E2DA] text-center">
                        <p className="text-[13px] text-[#6b6b60]">
                            Don&apos;t have an account?{' '}
                            <Link
                                href="/signup"
                                className="text-[#3730a3] font-semibold hover:text-[#312e81] no-underline transition-colors"
                            >
                                Create one free →
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
