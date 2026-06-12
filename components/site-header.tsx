import { Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-4 z-40 px-4">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-full border border-border/80 bg-card/70 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Crosshair className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            Lead<span className="text-primary">Hunter</span>
          </span>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#hunt" className="transition-colors hover:text-foreground">
            Chasser
          </a>
          <a href="#results" className="transition-colors hover:text-foreground">
            Résultats
          </a>
          <a
            href="https://www.browseract.com"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            BrowserAct
          </a>
        </nav>
        <Button size="sm" className="rounded-full" render={<a href="#hunt" />}>
          Démarrer
        </Button>
      </div>
    </header>
  );
}
