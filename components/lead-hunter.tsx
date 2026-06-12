"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Loader2,
  Star,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  TriangleAlert,
  Flame,
  History,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type SiteAnalysis = {
  url: string;
  finalUrl?: string;
  reachable: boolean;
  httpStatus?: number;
  score: number;
  grade: "no-site" | "hot" | "warm" | "cold" | "unknown";
  issues: string[];
};
type Lead = {
  name: string;
  address?: string;
  category?: string;
  phone?: string;
  rating?: string;
  reviews?: string;
  website?: string;
  email?: string;
  analysis: SiteAnalysis;
};
type Phase = "maps" | "scraping" | "enriching" | "analyzing" | "done" | "failed";
type Campaign = {
  taskId: string;
  keyword: string;
  area: string;
  limit: number;
  phase: Phase;
  status: string;
  leadCount?: number;
  createdAt: string;
};

const GRADES: Record<SiteAnalysis["grade"], { label: string; badge: string; ring: string }> = {
  "no-site": {
    label: "Pas de site",
    badge: "border-violet-500/40 bg-violet-500/15 text-violet-300",
    ring: "text-violet-400",
  },
  hot: {
    label: "Prospect chaud",
    badge: "border-red-500/40 bg-red-500/15 text-red-300",
    ring: "text-red-400",
  },
  warm: {
    label: "Tiède",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-300",
    ring: "text-amber-400",
  },
  cold: {
    label: "Bon site",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
    ring: "text-emerald-400",
  },
  unknown: {
    label: "Non vérifié",
    badge: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
    ring: "text-zinc-400",
  },
};

export function LeadHunter() {
  const [keyword, setKeyword] = React.useState("");
  const [area, setArea] = React.useState("");
  const [limit, setLimit] = React.useState(3);

  const [submitting, setSubmitting] = React.useState(false);
  const [taskId, setTaskId] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase | "">("");
  const [found, setFound] = React.useState(0);
  const [enriched, setEnriched] = React.useState(0);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [polling, setPolling] = React.useState(false);

  const [history, setHistory] = React.useState<Campaign[]>([]);

  React.useEffect(() => {
    // Au chargement : on récupère l'historique et on rouvre la dernière campagne terminée.
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => {
        const items: Campaign[] = d.items ?? [];
        setHistory(items);
        // Ouvre la campagne la plus récente (même en cours) et la suit en live.
        if (items[0]) openCampaign(items[0]);
      })
      .catch(() => {});
  }, []);

  function loadHistory() {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setHistory(d.items ?? []))
      .catch(() => {});
  }

  async function hunt() {
    if (!keyword.trim() || !area.trim()) {
      toast.error("Renseigne un métier et une ville");
      return;
    }
    setSubmitting(true);
    setLeads([]);
    setFound(0);
    setEnriched(0);
    setCampaign(null);
    try {
      const res = await fetch("/api/leads/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, area, limit }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTaskId(d.taskId);
      setPhase("maps");
      setPolling(true);
      toast.success("Chasse lancée 🎯");
      loadHistory();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // Polling de la campagne (machine à états : maps → enriching → analyzing → done)
  React.useEffect(() => {
    if (!polling || !taskId) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/leads/${taskId}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        if (stop) return;
        setPhase(d.phase);
        setFound(d.found ?? 0);
        setEnriched(d.enriched ?? 0);
        if (d.campaign) setCampaign(d.campaign);
        if (d.leads?.length) setLeads(d.leads);
        if (d.done) {
          setPolling(false);
          loadHistory();
          if (d.phase === "done") toast.success(`${d.leads?.length ?? 0} prospects analysés ✅`);
          else toast.error("Campagne échouée");
        }
      } catch {
        /* retry next tick */
      }
    };
    tick();
    const id = setInterval(tick, 3500);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [polling, taskId]);

  async function openCampaign(c: Campaign) {
    setTaskId(c.taskId);
    setPhase(c.phase);
    setCampaign(c);
    setKeyword(c.keyword);
    setArea(c.area);
    setLeads([]);
    try {
      const res = await fetch(`/api/leads/${c.taskId}`);
      const d = await res.json();
      setPhase(d.phase);
      setFound(d.found ?? 0);
      setEnriched(d.enriched ?? 0);
      setLeads(d.leads ?? []);
      if (!d.done) setPolling(true);
    } catch {
      /* ignore */
    }
  }

  const busy = polling && phase !== "done" && phase !== "failed";
  const hot = leads.filter((l) => l.analysis.grade === "hot" || l.analysis.grade === "no-site").length;
  const noSite = leads.filter((l) => l.analysis.grade === "no-site").length;

  return (
    <div className="relative">
      {/* halo */}
      <div className="glow-radial pointer-events-none absolute inset-x-0 top-0 h-[480px]" />

      {/* HERO + FORM */}
      <section id="hunt" className="relative mx-auto max-w-3xl px-4 pt-16 pb-10 text-center sm:pt-24">
        <Badge variant="outline" className="mb-5 rounded-full border-primary/30 bg-primary/10 text-primary">
          Propulsé par BrowserAct · Google Maps
        </Badge>
        <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Trouve des business <br className="hidden sm:block" />
          au <span className="text-primary">site éclaté</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
          On scrape Google Maps, on radiographie chaque site web, et on te sort les prospects
          qui ont <em>désespérément</em>{" "}besoin d&apos;une refonte. À toi de jouer.
        </p>

        <Card className="mt-9 rounded-2xl border-border/70 bg-card/60 text-left backdrop-blur-xl">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="kw" className="text-xs text-muted-foreground">
                Métier / mot-clé
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="kw"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && hunt()}
                  placeholder="plumber, dentist, coffee shop…"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area" className="text-xs text-muted-foreground">
                Zone
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="area"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && hunt()}
                  placeholder="Austin, TX"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>
            <Button
              onClick={hunt}
              disabled={submitting || busy}
              size="lg"
              className="h-11 rounded-xl px-6"
            >
              {submitting || busy ? <Loader2 className="animate-spin" /> : <Flame />}
              Chasser
            </Button>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
              <Label htmlFor="limit" className="text-xs text-muted-foreground">
                Nombre de résultats
              </Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={20}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="h-8 w-20 rounded-lg"
              />
              <span className="text-xs text-amber-400/80">
                ≈ {limit + 1} tâches BrowserAct (1 scrape + {limit} enrichissements) · pense aux crédits
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* PROGRESS */}
      {busy && (
        <div className="mx-auto max-w-3xl px-4">
          <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/60 px-4 py-3 text-sm backdrop-blur">
            <Loader2 className="size-4 animate-spin text-primary" />
            {phase === "maps" && <span>BrowserAct explore Google Maps…</span>}
            {phase === "scraping" && (
              <span>
                L’agent prospecte Google Maps…{" "}
                <span className="text-muted-foreground">
                  {leads.length}/{campaign?.limit ?? "?"} fiches
                </span>
              </span>
            )}
            {phase === "enriching" && (
              <span>
                Résolution des sites web via BrowserAct…{" "}
                <span className="text-muted-foreground">
                  {enriched}/{found} business
                </span>
              </span>
            )}
            {phase === "analyzing" && <span>Radiographie des sites web en cours…</span>}
          </div>
        </div>
      )}

      {/* RESULTS */}
      {leads.length > 0 && (
        <section id="results" className="mx-auto max-w-5xl px-4 py-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">
              {leads.length} prospects
              {campaign && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {campaign.keyword} à {campaign.area}
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <Badge className="border-red-500/40 bg-red-500/15 text-red-300">{hot} chauds</Badge>
              <Badge className="border-violet-500/40 bg-violet-500/15 text-violet-300">
                {noSite} sans site
              </Badge>
            </div>
          </div>

          <div className="grid gap-3">
            {leads.map((l, i) => {
              const g = GRADES[l.analysis.grade];
              return (
                <Card key={i} className="overflow-hidden rounded-xl border-border/70 bg-card/50">
                  <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    {/* score */}
                    <div className="flex shrink-0 items-center gap-3 sm:w-28 sm:flex-col sm:items-center sm:gap-1">
                      <div className={`text-3xl font-bold tabular-nums ${g.ring}`}>
                        {l.analysis.score < 0 ? "?" : l.analysis.score}
                      </div>
                      <Badge variant="outline" className={`${g.badge} rounded-full`}>
                        {g.label}
                      </Badge>
                    </div>

                    {/* infos */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{l.name}</span>
                        {l.category && (
                          <span className="truncate text-xs text-muted-foreground">{l.category}</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {l.rating && (
                          <span className="inline-flex items-center gap-1">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {l.rating}
                            {l.reviews && <span>({l.reviews})</span>}
                          </span>
                        )}
                        {l.phone && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3" />
                            {l.phone}
                          </span>
                        )}
                        {l.email && (
                          <a
                            href={`mailto:${l.email}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="size-3" />
                            {l.email}
                          </a>
                        )}
                        {l.address && <span className="truncate">{l.address}</span>}
                      </div>
                      {/* issues */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {l.analysis.issues.slice(0, 4).map((iss, k) => (
                          <span
                            key={k}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                          >
                            <TriangleAlert className="size-3" />
                            {iss}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* site */}
                    <div className="shrink-0">
                      {l.website ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          render={<a href={l.analysis.finalUrl ?? l.website} target="_blank" rel="noreferrer" />}
                        >
                          <Globe /> Voir le site <ExternalLink className="size-3" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="rounded-lg text-muted-foreground">
                          Aucun site
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* HISTORY */}
      {history.length > 0 && (
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            <History className="size-4" />
            <span>Campagnes précédentes (MongoDB)</span>
            <Button variant="ghost" size="icon-xs" onClick={loadHistory} aria-label="Rafraîchir">
              <RotateCcw />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map((c) => (
              <button
                key={c.taskId}
                onClick={() => openCampaign(c)}
                className="rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="font-medium">{c.keyword}</span>
                <span className="text-muted-foreground"> · {c.area}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.phase === "done" ? `${c.leadCount ?? 0} leads` : c.status}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
