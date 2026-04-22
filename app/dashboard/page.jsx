"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Image, LayoutDashboard, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import DashboardNavbar from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [projects, setProjects] = useState([]);
    const [user, setUser] = useState(null);

    const getAuthHeaders = async () => {
        const { data } = await supabase.auth.getSession();
        const token = data?.session?.access_token;

        if (!token) {
            router.push("/login");
            return null;
        }

        return {
            Authorization: `Bearer ${token}`,
        };
    };

    useEffect(() => {
        const load = async () => {
            const { data: auth } = await supabase.auth.getUser();
            const currentUser = auth?.user;

            if (!currentUser) {
                router.push("/login");
                return;
            }

            setUser(currentUser);

            const headers = await getAuthHeaders();
            if (!headers) return;

            const response = await fetch("/api/projects", { headers });
            const result = await response.json();

            if (response.ok) {
                setProjects(result.projects || []);
            } else {
                toast.error(result.error || "Unable to load projects.");
            }
        };

        load();
    }, [router]);

    const startProject = async () => {
        if (!user?.id) return;

        setLoading(true);

        const headers = await getAuthHeaders();
        if (!headers) {
            setLoading(false);
            return;
        }

        const response = await fetch("/api/projects", {
            method: "POST",
            headers: {
                ...headers,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: `Panorama project ${new Date().toLocaleDateString()}`,
            }),
        });
        const result = await response.json();

        setLoading(false);

        if (!response.ok) {
            toast.error(result.error || "Unable to create project.");
            return;
        }

        router.push(`/360editor/${result.project.id}`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <DashboardNavbar />

            <main className="mx-auto w-full max-w-6xl px-6 py-10">
                <section className="rounded-lg border bg-white p-8 shadow-sm">
                    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-md border px-3 py-1 text-sm text-muted-foreground">
                                <LayoutDashboard className="size-4" />
                                360Editor workspace
                            </div>
                            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950">
                                Build and review immersive panorama projects.
                            </h1>
                            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                                Create a project, import named images into Supabase Storage, and preview them in a 360 viewer.
                            </p>
                        </div>

                        <div className="rounded-md border bg-slate-50 p-5">
                            <p className="text-sm font-medium text-muted-foreground">Project capacity</p>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-md bg-white p-4">
                                    <p className="text-2xl font-semibold">{projects.length}</p>
                                    <p className="text-xs text-muted-foreground">Projects</p>
                                </div>
                                <div className="rounded-md bg-white p-4">
                                    <p className="text-2xl font-semibold">30</p>
                                    <p className="text-xs text-muted-foreground">Images each</p>
                                </div>
                            </div>
                            <Button
                                className="mt-5 h-11 w-full"
                                onClick={startProject}
                                disabled={loading || !user}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <Plus />}
                                {loading ? "Creating project..." : "Start 360 Editor"}
                            </Button>
                        </div>
                    </div>
                </section>

                <section className="mt-8">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-semibold">Recent projects</h2>
                            <p className="text-sm text-muted-foreground">
                                Continue a project or start a fresh panorama.
                            </p>
                        </div>
                    </div>

                    {projects.length ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {projects.map((project) => (
                                <Link
                                    key={project.id}
                                    href={`/360editor/${project.id}`}
                                    className="group rounded-lg border bg-white p-5 shadow-sm transition hover:border-slate-400"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex size-11 items-center justify-center rounded-md bg-slate-900 text-white">
                                            <Image className="size-5" />
                                        </div>
                                        <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1" />
                                    </div>
                                    <h3 className="mt-4 truncate font-semibold">{project.name}</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {(project.images || []).length} image{(project.images || []).length === 1 ? "" : "s"}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-dashed bg-white p-10 text-center">
                            <Image className="mx-auto mb-3 size-8 text-slate-400" />
                            <p className="font-medium">No projects yet</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Start the editor to create your first project.
                            </p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
