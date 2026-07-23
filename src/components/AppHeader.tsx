import Link from "next/link";
import { UserMenu } from "./UserMenu";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Systems PEX
          </span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
