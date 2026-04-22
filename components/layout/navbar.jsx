"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Boxes, LogOutIcon } from "lucide-react";

export default function DashboardNavbar() {
    const [user, setUser] = useState(null);
    const [firstName, setFirstName] = useState("");

    useEffect(() => {
        const load = async () => {
            const { data: auth } = await supabase.auth.getUser();
            const u = auth?.user;
            setUser(u);

            if (!u?.id) return;

            const { data: profile } = await supabase
                .from("profiles")
                .select("first_name")
                .eq("id", u.id)
                .single();

            if (profile?.first_name) {
                setFirstName(profile.first_name);
            }
        };

        load();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const displayName =
        firstName ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "User";

    return (
        <div className="sticky top-0 z-20 w-full border-b bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-black text-white">
                    <Boxes className="size-5" />
                </div>
                <div>
                    <span className="block text-lg font-semibold leading-none">360Editor</span>
                    <span className="text-sm text-muted-foreground">Dashboard</span>
                </div>
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger>
                    <Avatar className="cursor-pointer border">
                        <AvatarImage src="" alt="avatar" />
                        <AvatarFallback>
                            {displayName?.[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-48 mr-4">
                    <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                        <LogOutIcon /> Logout
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </div>
        </div>
    );
}
