// app/how-it-works/page.jsx — the real "how it works" page (replaces /#steps)
// Holds the editor mockup, the four steps, and the three reasons that used to
// live in the middle of the landing page.
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import SiteShell from '@/components/360editor/site/site_shell'

export const metadata = {
    title: 'How it works — 360Editor',
    description: 'Upload panoramas, link the rooms with arrows, brand it, publish. Four steps.',
}

const STEPS = [
    ['1', 'Add your scenes',
        'Upload a 360° photo for each room into the left panel — up to 30 in one tour. Click a scene to open it in the middle viewer.'],
    ['2', 'Drop the arrows',
        'Drag an arrow from the right panel onto a doorway in the view, then pick the room it leads to. That link is your navigation.'],
    ['3', 'Brand and adjust',
        'Add your logo and drag it where you want, set one size for all arrows, choose the auto-spin, and give each arrow a label.'],
    ['4', 'Preview, then publish',
        'Hit Preview to walk the finished tour, then publish it to a permanent link you can send to a client — or download the standalone HTML file and host it yourself.'],
]

const REASONS = [
    ['You own the result',
        'Every tour can be downloaded as one self-contained HTML file. Put it on your site, email it to a client, or keep it on a USB stick — it keeps working with nothing tied back to us.'],
    ['The hard part is just dragging',
        'Drop an arrow where a doorway is, pick the room it leads to, done. If you can move a file on your desktop, you can build the navigation.'],
    ['Made for client work',
        'Add your logo as a watermark, choose where the tour opens, size your arrows, and it plays fine on a phone. Hand it over and it looks like yours.'],
]

export default async function HowItWorksPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    return (
        <SiteShell user={user ? { email: user.email } : null} active="/how-it-works">

            {/* ── Header ── */}
            <section className="relative grain overflow-hidden bg-[#0d0c14]">
                <div className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-[120px]" style={{ background:'radial-gradient(circle,rgba(55,48,163,.55),transparent 70%)' }} />
                <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
                    <h1 className="serif text-white text-[clamp(30px,4.4vw,46px)] font-semibold tracking-[-1.2px] leading-[1.08] mb-4 fade-up">
                        Three panels, one screen, four steps.
                    </h1>
                    <p className="text-[16px] text-[#b9b9cc] max-w-[480px] mx-auto fade-up" style={{ animationDelay:'.06s' }}>
                        Scenes on the left, your live 360° view in the middle, arrows and branding
                        on the right. Here&apos;s the whole thing.
                    </p>
                </div>
            </section>

            {/* ── Editor mockup ── */}
            <section className="max-w-5xl mx-auto px-6 py-16">
                <div className="rounded-2xl border border-[#E2E2DA] shadow-xl overflow-hidden bg-white" data-reveal>
                    <div className="flex items-center justify-between px-4 h-11 bg-[#F4F4EF] border-b border-[#E2E2DA]">
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#1a1a18]">
                            <span className="w-2 h-2 rounded-full bg-[#3730a3]" /> Apartment Tour
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12px] border border-[#E2E2DA] bg-white text-[#1a1a18] px-3 py-1 rounded-lg font-medium">Preview</span>
                            <span className="text-[12px] bg-[#3730a3] text-white px-3 py-1 rounded-lg font-medium">Publish</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-[130px_1fr_150px] md:grid-cols-[190px_1fr_210px] h-[300px] md:h-[360px]">
                        {/* LEFT — scenes */}
                        <div className="border-r border-[#E2E2DA] bg-[#FAFAF7] p-3 overflow-hidden">
                            <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-2.5">Scenes</div>
                            {[['Living Room','#4a4368','0s',true],['Hallway','#3a4566','.5s',false],['Balcony','#9fc6e8','1s',false]].map(([name,col,d,active]) => (
                                <div key={name} className="flex items-center gap-2 mb-2 p-1.5 rounded-lg border border-[#E2E2DA] bg-white"
                                     style={{ animation:`dropIn .6s ease ${d} both`, boxShadow: active ? '0 0 0 2px #3730a3' : 'none' }}>
                                    <span className="w-9 h-7 rounded-md shrink-0" style={{ background:col }} />
                                    <span className="text-[11px] text-[#1a1a18] font-medium truncate">{name}</span>
                                </div>
                            ))}
                            <div className="mt-2 border-2 border-dashed border-[#cdcdc2] rounded-lg py-3 text-center text-[10px] text-[#9a9a8e]"
                                 style={{ animation:'glowPulse 2.4s ease-in-out infinite 1.4s' }}>
                                + Upload panorama
                            </div>
                        </div>

                        {/* MIDDLE — viewer */}
                        <div className="relative overflow-hidden" style={{ background:'radial-gradient(120% 90% at 50% 30%, #4a4368 0%, #2a2740 55%, #15131f 100%)' }}>
                            <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ backgroundImage:'repeating-linear-gradient(90deg,transparent 0 38px,rgba(184,155,115,.18) 38px 40px)' }} />
                            <div className="absolute left-[30%] top-[52%] flex flex-col items-center" style={{ animation:'arrowPop 4s ease-in-out infinite' }}>
                                <span className="mb-1 text-[10px] font-semibold text-white bg-black/60 px-2 py-0.5 rounded-md whitespace-nowrap">Go to Hallway</span>
                                <div className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-white/60" style={{ background:'rgba(55,48,163,.55)', backdropFilter:'blur(3px)' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                                </div>
                            </div>
                            <div className="absolute left-[60%] top-[40%]" style={{ animation:'arrowPop 4s ease-in-out infinite 1.3s' }}>
                                <div className="w-11 h-11 rounded-full flex items-center justify-center border-[1.5px] border-white/60" style={{ background:'rgba(55,48,163,.55)', backdropFilter:'blur(3px)' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                                </div>
                            </div>
                            <div className="absolute right-4 bottom-3 text-white/85 font-bold text-[12px] flex items-center gap-1.5" style={{ animation:'dropIn .7s ease 1.8s both' }}>
                                <span className="w-4 h-4 rounded bg-[#a3e635]" /> YOUR LOGO
                            </div>
                            <div className="absolute left-1/2 -translate-x-1/2 top-3 text-[10.5px] text-white/80 bg-black/35 px-3 py-1 rounded-full backdrop-blur">
                                Living Room · drag to look around
                            </div>
                        </div>

                        {/* RIGHT — directions */}
                        <div className="border-l border-[#E2E2DA] bg-[#FAFAF7] p-3 overflow-hidden">
                            <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-2">Directions</div>
                            <div className="grid grid-cols-2 gap-1.5 mb-3">
                                {['M12 19V5M5 12l7-7 7 7','M19 12H5M12 19l-7-7 7-7','M7 17L17 7M7 7h10v10','M17 17L7 7M17 7H7v10'].map((d,i)=>(
                                    <div key={i} className="aspect-square rounded-lg border border-[#E2E2DA] bg-white flex items-center justify-center"
                                         style={{ animation:`dropIn .5s ease ${0.2*i}s both`, boxShadow:i===0?'0 0 0 2px #3730a3':'none' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase">Hotspot size</span>
                                <span className="text-[9px] text-[#9a9a8e] font-mono">90px</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[#E2E2DA] overflow-hidden mb-3">
                                <div className="h-full bg-[#3730a3] rounded-full" style={{ animation:'barFill 2.6s ease-in-out infinite alternate' }} />
                            </div>
                            <div className="text-[10px] font-bold tracking-widest text-[#9a9a8e] uppercase mb-1.5">Placed</div>
                            {['→ Hallway','↑ Balcony'].map((t,i)=>(
                                <div key={t} className="text-[11px] text-[#1a1a18] bg-white border border-[#E2E2DA] rounded-md px-2 py-1.5 mb-1.5" style={{ animation:`dropIn .5s ease ${0.6+0.3*i}s both` }}>{t}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Steps ── */}
            <section className="bg-white border-y border-[#E2E2DA]">
                <div className="max-w-5xl mx-auto px-6 py-16">
                    <h2 className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-8 text-center" data-reveal>
                        Four steps, start to finish
                    </h2>
                    <div className="grid md:grid-cols-2 gap-5">
                        {STEPS.map(([n, title, body]) => (
                            <div key={n} className="flex gap-4 bg-[#FAFAF7] border border-[#E2E2DA] rounded-2xl p-5" data-reveal>
                                <div className="shrink-0 w-10 h-10 rounded-xl bg-[#3730a3] text-white flex items-center justify-center font-bold text-[15px]">{n}</div>
                                <div>
                                    <h3 className="text-[15.5px] font-semibold text-[#1a1a18] mb-1">{title}</h3>
                                    <p className="text-[14px] text-[#6b6b60] leading-relaxed">{body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Reasons ── */}
            <section className="max-w-5xl mx-auto px-6 py-16">
                <h2 className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-2 text-center" data-reveal>
                    Why people actually use it
                </h2>
                <p className="text-[15px] text-[#6b6b60] text-center max-w-[460px] mx-auto mb-10" data-reveal>
                    It&apos;s built to get a finished, shareable tour into your hands — not to lock you into a subscription.
                </p>
                <div className="grid md:grid-cols-3 gap-6">
                    {REASONS.map(([title, body]) => (
                        <div key={title} className="bg-white border border-[#E2E2DA] rounded-2xl p-6" data-reveal>
                            <div className="w-9 h-9 rounded-xl bg-[#3730a3]/8 flex items-center justify-center mb-4">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                            </div>
                            <h3 className="text-[16px] font-semibold text-[#1a1a18] mb-2">{title}</h3>
                            <p className="text-[14px] text-[#6b6b60] leading-relaxed">{body}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="max-w-5xl mx-auto px-6 pb-20">
                <div className="relative rounded-3xl overflow-hidden bg-[#3730a3] text-center px-6 py-12 glow-indigo grain" data-reveal>
                    <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-[90px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.28),transparent 70%)' }} />
                    <h2 className="serif relative text-white text-[clamp(22px,3.2vw,32px)] font-semibold tracking-[-0.6px] mb-3">
                        ₹500 for your first tour.
                    </h2>
                    <p className="relative text-[15px] text-white/80 max-w-[380px] mx-auto mb-7">
                        One credit, one tour, no subscription behind it.
                    </p>
                    <div className="relative flex items-center justify-center gap-3 flex-wrap">
                        <Link href="/pricing" className="inline-flex items-center justify-center h-11 px-7 rounded-xl bg-white text-[#3730a3] text-[14.5px] font-bold no-underline hover:bg-[#f4f4ef] transition-colors">
                            Buy credits →
                        </Link>
                        <Link href={user ? '/360editor' : '/signup'} className="inline-flex items-center justify-center h-11 px-7 rounded-xl border border-white/40 text-white text-[14.5px] font-semibold no-underline hover:bg-white/12 transition-colors">
                            {user ? 'Go to dashboard' : 'Create an account'}
                        </Link>
                    </div>
                </div>
            </section>
        </SiteShell>
    )
}