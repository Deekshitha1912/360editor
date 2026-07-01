// app/360editor/page.js  — dashboard (logged-in only, server component)
// Profiles are no longer fetched here — the client loads them from /api/profile.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardClient from "@/components/360editor/dashboard/dashboard";

export default async function Page() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Not logged in → send to landing
    if (!user) redirect('/')

    const { data: projects } = await supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    return (
        <DashboardClient
            user={{ id: user.id, email: user.email }}
            projects={projects ?? []}
        />
    )
}