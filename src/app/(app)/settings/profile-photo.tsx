"use client";

import { useRef, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Camera, ImageUp, Loader2Icon, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  removeAvatarAction,
  updateAvatarAction,
} from "@/features/user/actions";
import { cn } from "@/lib/utils";
import { PhotoError, resizePhoto } from "./resize-photo";

// Settings header — the avatar is the way to change it: tap it for
// "Upload / Change photo" and, when there is one, "Remove photo". The
// photo is shrunk in the browser (resize-photo.ts) and saved to Vercel
// Blob; without a Blob store connected, only "Remove photo" is offered
// (or nothing at all, and the avatar is just a picture).
export function ProfilePhoto({
  image,
  initial,
  uploadEnabled,
}: {
  image: string | null;
  initial: string;
  uploadEnabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared at once, so picking the same file again still fires.
    event.target.value = "";
    if (!file) return;
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("photo", await resizePhoto(file));
        const result = await updateAvatarAction(data);
        if (result.status === "error") {
          toast.error(result.message ?? "Couldn't save the photo.");
        } else {
          toast.success("Photo updated");
        }
      } catch (error) {
        toast.error(
          error instanceof PhotoError
            ? error.message
            : "Couldn't upload the photo. Try again.",
        );
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const result = await removeAvatarAction();
        if (result.status === "error") {
          toast.error(result.message ?? "Couldn't remove the photo.");
        } else {
          toast.success("Photo removed");
        }
      } catch {
        toast.error("Couldn't remove the photo. Try again.");
      }
    });
  }

  const face = (
    <span className="relative block size-[72px]">
      {image ? (
        // External avatar URL (Google, or our Blob store); next/image would
        // need remotePatterns config for a single small circular image
        // that's never resized.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="rounded-pill size-[72px] object-cover"
        />
      ) : (
        <span className="bg-burgundy rounded-pill text-on-accent flex size-[72px] items-center justify-center text-2xl font-semibold">
          {initial}
        </span>
      )}
      {pending && (
        <span className="rounded-pill absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2Icon className="size-6 animate-spin text-white" aria-hidden />
        </span>
      )}
    </span>
  );

  if (!uploadEnabled && !image) {
    return <div className="shrink-0">{face}</div>;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Change photo"
          aria-busy={pending}
          disabled={pending}
          className={cn(
            "group rounded-pill relative shrink-0 outline-none",
            "focus-visible:ring-ring/50 focus-visible:ring-3",
            "disabled:cursor-default",
          )}
        >
          {face}
          <span
            aria-hidden
            className={cn(
              "rounded-pill bg-surface text-text-secondary ring-border-soft absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center shadow-sm ring-1 transition-colors duration-(--dur-2)",
              "group-hover:text-text-primary",
              pending && "opacity-0",
            )}
          >
            <Camera className="size-4" strokeWidth={1.7} />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-40">
          {uploadEnabled && (
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              <ImageUp aria-hidden />
              {image ? "Change photo" : "Upload photo"}
            </DropdownMenuItem>
          )}
          {image && (
            <DropdownMenuItem variant="destructive" onClick={remove}>
              <Trash2 aria-hidden />
              Remove photo
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {uploadEnabled && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          tabIndex={-1}
          onChange={upload}
        />
      )}
    </>
  );
}
