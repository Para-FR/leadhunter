import { SiteHeader } from "@/components/site-header";
import { LeadHunter } from "@/components/lead-hunter";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1 pb-10">
        <LeadHunter />
      </main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        LeadHunter — POC · Next.js 16 · shadcn/ui · MongoDB · BrowserAct
      </footer>
    </div>
  );
}
