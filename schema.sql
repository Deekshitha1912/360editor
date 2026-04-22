create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid not null,
    first_name text null,
    last_name text null,
    email text not null unique,
    role text not null default 'USER',
    created_time timestamp with time zone not null default now(),
    constraint profiles_pkey primary key (id),
    constraint profiles_id_fkey
        foreign key (id)
        references auth.users (id)
        on delete cascade
);

create table if not exists public.projects (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null,
    name text not null default 'Untitled panorama',
    images jsonb not null default '[]'::jsonb,
    panorama_config jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint projects_pkey primary key (id),
    constraint projects_user_id_fkey
        foreign key (user_id)
        references auth.users (id)
        on delete cascade
);

create index if not exists projects_user_id_idx
    on public.projects (user_id, updated_at desc);

alter table public.projects
    add column if not exists panorama_config jsonb not null default '{}'::jsonb;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

create policy "Users can read their own profile"
    on public.profiles
    for select
    using (auth.uid() = id);

create policy "Users can read their own projects"
    on public.projects
    for select
    using (auth.uid() = user_id);

create policy "Users can create their own projects"
    on public.projects
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own projects"
    on public.projects
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
    on public.projects
    for delete
    using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('project-images', 'project-images', false)
on conflict (id) do nothing;

create policy "Users can read their own project images"
    on storage.objects
    for select
    using (
        bucket_id = 'project-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "Users can upload their own project images"
    on storage.objects
    for insert
    with check (
        bucket_id = 'project-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "Users can update their own project images"
    on storage.objects
    for update
    using (
        bucket_id = 'project-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    )
    with check (
        bucket_id = 'project-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );

create policy "Users can delete their own project images"
    on storage.objects
    for delete
    using (
        bucket_id = 'project-images'
        and auth.uid()::text = (storage.foldername(name))[1]
    );
