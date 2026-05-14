"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/library/utils";

type UserAvatarProps = {
  name: string;
  avatarPath?: string | null;
  src?: string | null;
  size?: "default" | "sm" | "lg";
  className?: string;
  fallbackClassName?: string;
};

function avatarUrl(avatarPath: string | null | undefined) {
  return avatarPath ? `/avatar/${encodeURIComponent(avatarPath)}` : null;
}

export function UserAvatar({
  name,
  avatarPath,
  src,
  size = "default",
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const avatarSrc = src ?? avatarUrl(avatarPath);
  const fallbackText = name.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <Avatar size={size} className={cn("bg-muted", className)}>
      {avatarSrc ? (
        <AvatarImage src={avatarSrc} alt={name} />
      ) : (
        <AvatarFallback className={fallbackClassName}>
          {fallbackText}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
