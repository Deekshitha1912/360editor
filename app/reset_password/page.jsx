'use client'
// app/reset_password/page.jsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ResetPasswordPage() {
    const router = useRouter()
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
        if (password !== confirm) { setError('Passwords do not match.'); return }
        setLoading(true)
        try {
            const res = await fetch('/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(res.status === 401
                    ? 'This reset link is invalid or has expired. Please request a new one.'
                    : (json.error || 'Could not reset password.'))
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
            <div className="w-full max-w-[400px] fade-up">
                <Link href="/" className="flex items-center gap-2.5 justify-center mb-10 no-underline group">
                    <div className="w-9 h-9 bg-[#3730a3] rounded-xl flex items-center justify-center shadow-sm group-hover:bg-[#312e81] transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                        </svg>
                    </div>
                    <span className="text-[#1a1a18] font-bold text-xl tracking-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        360<span className="text-[#3730a3]">Editor</span>
                    </span>
                </Link>

                <div className="bg-white rounded-2xl border border-[#E2E2DA] p-8 shadow-[0_4px_24px_rgba(0,0,0,0.07)]">
                    <div className="mb-7">
                        <h1 className="text-2xl font-semibold text-[#1a1a18] mb-1.5" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Set a new password</h1>
                        <p className="text-[#6b6b60] text-sm">Choose a strong password you haven't used before.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="password" className="text-[13px] font-medium text-[#1a1a18]">New password</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Min 8 characters"
                                   className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="confirm" className="text-[13px] font-medium text-[#1a1a18]">Confirm password</Label>
                            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} placeholder="Re-enter password"
                                   className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px] bg-[#FAFAF7]" />
                        </div>
                        {error && (
                            <Alert variant="destructive" className="border-red-200 bg-red-50 py-2.5">
                                <AlertDescription className="text-red-700 text-[13px]">{error}</AlertDescription>
                            </Alert>
                        )}
                        <Button type="submit" disabled={loading} className="w-full h-10 bg-[#3730a3] hover:bg-[#312e81] text-white font-semibold text-[14px] rounded-lg transition-colors">
                            {loading ? 'Saving…' : 'Update password'}
                        </Button>
                    </form>
                    <div className="mt-6 pt-5 border-t border-[#E2E2DA] text-center">
                        <p className="text-[13px] text-[#6b6b60]">
                            <Link href="/login" className="text-[#3730a3] font-semibold hover:text-[#312e81] no-underline transition-colors">Back to login</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}