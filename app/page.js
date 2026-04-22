"use client";

import { ArrowRight, Boxes, ImageUp, ScanEye } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <nav className="border-b bg-white/90 px-6 py-4 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-md bg-black text-white">
                            <Boxes className="size-5" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold">360Editor</p>
                            <p className="text-xs text-muted-foreground">Panorama project studio</p>
                        </div>
                    </div>

                    <Button variant="outline" onClick={() => router.push("/login")}>
                        Login
                    </Button>
                </div>
            </nav>

            <main className="mx-auto grid min-h-[calc(100vh-73px)] max-w-6xl gap-10 px-6 py-12 lg:grid-cols-[1fr_480px] lg:items-center">
                <section>
                    <p className="mb-4 inline-flex rounded-md border bg-white px-3 py-1 text-sm text-muted-foreground">
                        Supabase powered 360 image workflow
                    </p>
                    <h1 className="max-w-3xl text-5xl font-semibold tracking-tight">
                        360Editor
                    </h1>
                    <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                        Import named panorama images, store them by user and project, and review each file in a clean 360 viewer.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Button size="lg" onClick={() => router.push("/login")}>
                            Get started
                            <ArrowRight />
                        </Button>
                        <Button size="lg" variant="outline" onClick={() => router.push("/signup")}>
                            Create account
                        </Button>
                    </div>
                </section>

                <section className="rounded-lg border bg-white p-5 shadow-sm">
                    <div className="aspect-[4/3] overflow-hidden rounded-md bg-slate-950">
                        <div className="grid h-full grid-cols-[120px_1fr]">
                            <div className="space-y-3 border-r border-white/10 p-4">
                                {[1, 2, 3].map((item) => (
                                    <div key={item} className="h-20 rounded-md bg-white/15" />
                                ))}
                            </div>
                            <div className="relative flex items-center justify-center">
                                <div className="absolute inset-8 rounded-full border border-emerald-300/50" />
                                <ScanEye className="size-16 text-emerald-300" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-md border p-4">
                            <ImageUp className="mb-3 size-5 text-emerald-600" />
                            <p className="text-sm font-medium">Named uploads</p>
                            <p className="mt-1 text-xs text-muted-foreground">Organized in Storage paths.</p>
                        </div>
                        <div className="rounded-md border p-4">
                            <ScanEye className="mb-3 size-5 text-emerald-600" />
                            <p className="text-sm font-medium">Panorama view</p>
                            <p className="mt-1 text-xs text-muted-foreground">Drag images into the viewer.</p>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
