// app/360editor/project/[id]/page.jsx
import ProjectClient from '@/components/360editor/project/middle'

export default async function ProjectPage({ params }) {
    const { id } = await params
    return <ProjectClient projectId={id} />
}