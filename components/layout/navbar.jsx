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

export default function DashboardNavbar() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser();
            setUser(data.user);
        };
        getUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const fullName =
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
                            {fullName[0]?.toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </DropdownMenuTrigger>

                <DropdownMenuContent className="w-48 mr-4">
                    <DropdownMenuLabel>{fullName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                        Logout
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
