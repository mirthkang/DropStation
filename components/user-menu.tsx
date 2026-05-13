"use client";

import Link from "next/link";
import { LayoutDashboard, LogOut, UserRound, UploadCloud } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signoutAction } from "@/library/actions/auth";
import { cn } from "@/library/utils";

type UserMenuProps = {
  user: {
    name: string;
    username: string;
    isAdmin: boolean;
  };
};

export function UserMenu({ user }: UserMenuProps) {
  const avatarText = user.name.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" className="h-9 gap-2 px-2" />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{avatarText}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" >
        <div className="flex min-w-0 items-baseline gap-1.5 px-1.5 py-1.5">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            @{user.username}
          </span>
        </div>
        <DropdownMenuItem render={<Link href="/shares" />}>
          <UploadCloud className="size-4" />
          我的分享
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserRound className="size-4" />
          我的账户
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.isAdmin ? (
          <>
            <DropdownMenuItem render={<Link href="/admin" />}>
              <LayoutDashboard className="size-4" />
              后台管理
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <form action={signoutAction} className="w-full">
          <button
            type="submit"
            role="menuitem"
            className={cn(
              "relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-sm text-destructive outline-hidden select-none",
              "hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive dark:hover:bg-destructive/20 dark:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
            )}
          >
            <LogOut className="size-4" />
            退出登录
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
