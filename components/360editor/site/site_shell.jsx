// components/360editor/site/site_shell.jsx
// Fonts + shared page styles + nav + footer for every public page (landing,
// /how-it-works, /pricing, /privacy, /terms). Server component — no hooks here.
//
// The old inline <Script> that drove [data-reveal] is gone. It ran once per full
// page load, so after a soft navigation nothing installed the observer and every
// revealed block stayed invisible until a manual reload. <Reveal /> is a client
// component that re-runs on each navigation instead.
import SiteNav from '@/components/360editor/site/site_nav'
import SiteFooter from '@/components/360editor/site/site_footer'
import Reveal from '@/components/360editor/site/reveal'

export default function SiteShell({ user, active, children }) {
    return (
        <div className="min-h-screen bg-[#FAFAF7] overflow-x-hidden flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&display=swap"
                rel="stylesheet"
            />
            <style>{`
              .serif{font-family:'Fraunces',Georgia,serif}
              .fade-up{opacity:0;transform:translateY(18px);animation:fadeUp .8s cubic-bezier(.16,1,.3,1) forwards}
              @keyframes fadeUp{to{opacity:1;transform:none}}
              [data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
              [data-reveal].in{opacity:1;transform:none}
              .glow-indigo{box-shadow:0 30px 80px -28px rgba(55,48,163,.55)}
              .grain:before{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
                background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:3px 3px}
              @keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
              @keyframes dropIn{0%{opacity:0;transform:translateY(-14px) scale(.96)}100%{opacity:1;transform:none}}
              @keyframes arrowPop{0%,40%{opacity:0;transform:scale(.4)}55%{opacity:1;transform:scale(1.15)}70%,100%{opacity:1;transform:scale(1)}}
              @keyframes barFill{from{width:14%}to{width:100%}}
              @keyframes glowPulse{0%,100%{opacity:.55}50%{opacity:1}}
              @media (prefers-reduced-motion: reduce){
                .fade-up,[data-reveal]{animation:none!important;transition:none!important;opacity:1!important;transform:none!important}
              }
              @media (scripting: none){[data-reveal]{opacity:1!important;transform:none!important}}
            `}</style>

            <SiteNav user={user} active={active} />

            <main className="flex-1">{children}</main>

            <SiteFooter />

            <Reveal />
        </div>
    )
}