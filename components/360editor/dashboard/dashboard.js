'use client'
// components/360editor/dashboard/dashboard.js
// Loads the profile from /api/profile (no profiles fetch in the page).
// Warm, human copy. All create/delete/logout logic is unchanged.
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,} from '@/components/ui/dialog'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,} from '@/components/ui/dropdown-menu'

// Deterministic gradient + accent per project so each card thumbnail feels distinct
const THUMBS = [
    ['#4a4368', '#2a2740', '#8a7fc4'],
    ['#3a4566', '#1f2436', '#9fb4ff'],
    ['#5b7692', '#2c3450', '#a8d0ff'],
    ['#7a6a52', '#3d3225', '#ffe6a8'],
    ['#4f5b92', '#262d4a', '#aab4ff'],
    ['#6b4a68', '#2f2440', '#e0a8d8'],
]
function thumbFor(id) {
    const s = String(id)
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return THUMBS[h % THUMBS.length]
}

export default function DashboardClient({ user, projects: initialProjects }) {
    const router = useRouter()
    const [projects, setProjects] = useState(initialProjects)
    const [profile, setProfile] = useState(null)
    const [showNewProject, setShowNewProject] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    // Profile comes from the API now, not the page.
    useEffect(() => {
        let alive = true
        fetch('/api/profile')
            .then(r => (r.ok ? r.json() : null))
            .then(d => { if (alive && d?.profile) setProfile(d.profile) })
            .catch(() => {})
        return () => { alive = false }
    }, [])

    async function handleLogout() {
        await fetch('/api/logout', { method: 'POST' })
        router.push('/')
        router.refresh()
    }

    async function createProject() {
        if (!projectName.trim()) return
        setCreating(true)
        setError('')

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName.trim() }),
            })
            const json = await res.json()
            if (!res.ok) { setError(json.error || 'Failed to create project.'); return }

            setProjects([json.project, ...projects])
            setProjectName('')
            setShowNewProject(false)
            router.push(`/360editor/project/${json.project.id}`)
        } catch {
            setError('Network error — please try again.')
        } finally {
            setCreating(false)
        }
    }

    async function deleteProject(id, e) {
        e.stopPropagation()
        if (!confirm('Delete this tour and everything in it?')) return
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
        if (res.ok) setProjects(projects.filter(p => p.id !== id))
    }

    const email = profile?.email || user?.email || ''
    const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
    const initials = displayName
        ? displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
        : email?.[0]?.toUpperCase() || '?'

    return (
        <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* Fonts + page-scoped styles (mirrors the landing page, self-contained) */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            />
            <style>{`
              .serif{font-family:'Fraunces',Georgia,serif}
              .fade-up{opacity:0;transform:translateY(16px);animation:dashFadeUp .65s cubic-bezier(.16,1,.3,1) forwards}
              @keyframes dashFadeUp{to{opacity:1;transform:none}}
              .grain:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
                background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);background-size:3px 3px}
              @media (prefers-reduced-motion: reduce){
                .fade-up{animation:none!important;opacity:1!important;transform:none!important}
              }
            `}</style>

            {/* NAV */}
            <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-[#E2E2DA]">
                <div className="max-w-6xl mx-auto px-6 h-[60px] flex items-center justify-between">
                    <Link href="/360editor" className="flex items-center gap-2.5 no-underline group">
                        <div className="w-8 h-8 bg-[#3730a3] rounded-lg flex items-center justify-center transition-colors group-hover:bg-[#312e81]">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <span className="text-[#1a1a18] font-bold text-[18px] tracking-tight">
              360<span className="text-[#3730a3]">Editor</span>
            </span>
                    </Link>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="w-9 h-9 rounded-full bg-[#3730a3] text-white text-sm font-bold flex items-center justify-center hover:bg-[#312e81] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3730a3] focus:ring-offset-2">
                                {initials}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 shadow-lg border-[#E2E2DA]">
                            <div className="px-3 py-2">
                                <p className="text-xs font-medium text-[#1a1a18] truncate">{displayName || 'My Account'}</p>
                                <p className="text-[11px] text-[#6b6b60] truncate">{email}</p>
                            </div>
                            <DropdownMenuSeparator className="bg-[#E2E2DA]" />
                            <DropdownMenuItem
                                onClick={handleLogout}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer text-[13px]"
                            >
                                Sign out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </nav>

            {/* WELCOME BANNER */}
            <div className="relative overflow-hidden bg-[#0d0c14] grain border-b border-[#E2E2DA]">
                <div className="pointer-events-none absolute -top-28 -left-20 w-[420px] h-[420px] rounded-full blur-[110px]" style={{ background:'radial-gradient(circle,rgba(55,48,163,.55),transparent 70%)' }} />
                <div className="pointer-events-none absolute -bottom-32 right-[-80px] w-[360px] h-[360px] rounded-full blur-[120px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.14),transparent 70%)' }} />
                <div className="relative max-w-6xl mx-auto px-6 py-10">
                    <p className="text-[13px] text-[#b9b9cc] font-medium mb-1.5 fade-up">
                        Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''} 👋
                    </p>
                    <h1 className="serif text-white text-[clamp(28px,4vw,40px)] font-semibold tracking-[-1px] leading-none fade-up" style={{ animationDelay:'.05s' }}>
                        {projects.length ? 'Pick up where you left off' : 'Let\u2019s build your first tour'}
                    </h1>
                    <div className="flex items-center gap-5 mt-5 fade-up" style={{ animationDelay:'.1s' }}>
                        <div className="flex items-center gap-2 text-[12.5px] text-[#cfcfe6]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#a3e635]" style={{ boxShadow:'0 0 8px #a3e635' }} />
                            {projects.length} {projects.length === 1 ? 'tour' : 'tours'}
                        </div>
                        <span className="text-white/20">·</span>
                        <span className="text-[12.5px] text-[#9a9ab2]">Each one exports to a single file you can send anywhere</span>
                    </div>
                </div>
            </div>

            {/* DASHBOARD */}
            <main className="max-w-6xl mx-auto px-6 py-10">
                <div className="flex items-center justify-between mb-7">
                    <h2 className="text-[17px] font-semibold text-[#1a1a18]">
                        Your tours
                    </h2>
                    <Button
                        onClick={() => setShowNewProject(true)}
                        className="bg-[#3730a3] hover:bg-[#312e81] text-white h-9 px-4 text-[13px] font-semibold rounded-lg gap-1.5 shadow-sm"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        New tour
                    </Button>
                </div>

                {/* New project dialog */}
                <Dialog
                    open={showNewProject}
                    onOpenChange={open => { setShowNewProject(open); if (!open) { setProjectName(''); setError('') } }}
                >
                    <DialogContent className="sm:max-w-[400px] border-[#E2E2DA] shadow-xl">
                        <DialogHeader>
                            <DialogTitle className="text-[18px] font-semibold serif">
                                Name your new tour
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-2">
                            <Label className="text-[13px] font-medium text-[#1a1a18] mb-1.5 block">What should we call it?</Label>
                            <Input
                                placeholder="e.g. Riverside Apartment"
                                value={projectName}
                                onChange={e => setProjectName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && createProject()}
                                autoFocus
                                className="h-10 border-[#E2E2DA] focus-visible:ring-[#3730a3] focus-visible:ring-1 focus-visible:border-[#3730a3] text-[14px]"
                            />
                            {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
                        </div>
                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => { setShowNewProject(false); setProjectName(''); setError('') }}
                                className="border-[#E2E2DA] text-[#6b6b60] hover:bg-[#F4F4EF] text-[13px] h-9"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={createProject}
                                disabled={creating || !projectName.trim()}
                                className="bg-[#3730a3] hover:bg-[#312e81] text-white text-[13px] h-9"
                            >
                                {creating ? 'Creating…' : 'Create tour'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Projects grid */}
                {projects.length === 0 ? (
                    <div className="border-2 border-dashed border-[#E2E2DA] rounded-2xl py-20 text-center bg-white/50 fade-up">
                        <div className="w-14 h-14 bg-[#3730a3]/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10"/>
                                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <h3 className="text-[16px] font-semibold text-[#1a1a18] mb-1.5">Nothing here yet</h3>
                        <p className="text-[13px] text-[#6b6b60] mb-5 max-w-[320px] mx-auto leading-relaxed">
                            Start your first tour — upload a few 360° photos, link the rooms, and export a file you can share.
                        </p>
                        <Button
                            onClick={() => setShowNewProject(true)}
                            className="bg-[#3730a3] hover:bg-[#312e81] text-white text-[13px] h-9 px-5 rounded-lg"
                        >
                            Create your first tour
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {projects.map((p, i) => {
                            const [c1, c2, accent] = thumbFor(p.id)
                            return (
                                <div
                                    key={p.id}
                                    onClick={() => router.push(`/360editor/project/${p.id}`)}
                                    className="group bg-white border border-[#E2E2DA] rounded-2xl overflow-hidden cursor-pointer transition-all hover:border-[#3730a3]/40 hover:shadow-[0_10px_30px_rgba(55,48,163,0.12)] hover:-translate-y-1 relative fade-up"
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    {/* Thumbnail — faux 360 scene, distinct per project */}
                                    <div
                                        className="relative h-[128px] overflow-hidden"
                                        style={{ background: `radial-gradient(120% 100% at 50% 25%, ${c1} 0%, ${c2} 70%, #15131f 100%)` }}
                                    >
                                        {/* perspective floor grid */}
                                        <div
                                            className="absolute inset-x-0 bottom-0 h-1/2 opacity-60"
                                            style={{ backgroundImage:'repeating-linear-gradient(90deg,transparent 0 26px,rgba(255,255,255,.12) 26px 27px)' }}
                                        />
                                        {/* horizon accent */}
                                        <div className="absolute left-0 right-0 top-1/2 h-px" style={{ background:`linear-gradient(90deg,transparent,${accent}66,transparent)` }} />
                                        {/* globe mark */}
                                        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-30 transition-transform duration-500 group-hover:scale-110" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1">
                                            <circle cx="12" cy="12" r="10"/>
                                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                        </svg>
                                        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold tracking-wider text-white/90 bg-black/30 backdrop-blur px-2 py-0.5 rounded">360°</span>
                                        {/* open hint on hover */}
                                        <span className="absolute bottom-2.5 left-3 text-[11px] font-medium text-white/0 group-hover:text-white/85 transition-colors flex items-center gap-1">
                                            Open editor
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                                        </span>
                                    </div>

                                    {/* Meta */}
                                    <div className="p-4">
                                        <div className="font-semibold text-[14px] text-[#1a1a18] mb-1 truncate pr-6">{p.name}</div>
                                        <div className="text-[12px] text-[#6b6b60]">
                                            {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>

                                    <button
                                        onClick={e => deleteProject(p.id, e)}
                                        aria-label="Delete tour"
                                        className="absolute top-2.5 left-2.5 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-red-500/80 transition-all bg-black/30 backdrop-blur border-none cursor-pointer"
                                        title="Delete tour"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M18 6L6 18M6 6l12 12"/>
                                        </svg>
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}