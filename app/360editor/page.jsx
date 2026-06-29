// app/360editor/page.js  — dashboard (logged-in only, server component)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardClient from "@/components/360editor/dashboard/dashboard";

export default async function Page() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Not logged in → send to landing
    if (!user) redirect('/')

    const [{ data: profile }, { data: projects }] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role')
            .eq('id', user.id)
            .single(),
        supabase
            .from('projects')
            .select('id, name, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
    ])

    return (
        <DashboardClient
            user={user}
            profile={profile ?? null}
            projects={projects ?? []}
        />
    )
}
