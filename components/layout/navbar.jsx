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
import { LogOutIcon } from "lucide-react";

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
        <div className="w-full flex items-center justify-between px-6 py-4 border-b bg-white shadow-sm">

            {/* Left: Logo */}
            <div className="flex items-center space-x-2">
                <span className="text-xl font-bold">MyLogo</span>
                <span className="text-gray-500">/ 360Editor</span>
            </div>

            {/* Right: Avatar dropdown */}
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
    );
}
