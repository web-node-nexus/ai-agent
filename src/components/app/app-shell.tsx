"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import {
  BottomNav,
  shouldHideAppChrome,
} from "@/components/app/bottom-nav";
import { cn } from "@/lib/utils";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = shouldHideAppChrome(pathname);

  return (
    <div className="relative flex min-h-dvh flex-col bg-mesh text-foreground">
      <main
        className={cn(
          "mx-auto flex w-full max-w-lg flex-1 flex-col",
          !hideChrome && "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"
        )}
      >
        {children}
      </main>
      {!hideChrome && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg">
          <BottomNav />
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-dvh flex-col bg-mesh text-foreground">
          <main className="mx-auto flex w-full max-w-lg flex-1 flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
            {children}
          </main>
        </div>
      }
    >
      <AppShellInner>{children}</AppShellInner>
    </Suspense>
  );
}
