# LeadHunter 🎯

Agent IA de prospection commerciale qui **scrape Google Maps**, **analyse la santé des sites web** des business locaux et **score** ceux qui ont besoin d'une refonte — le tout piloté par **Claude Code** avec un vrai navigateur grâce à **BrowserAct**.

> 🎬 Projet de démo de la vidéo : **Claude Code × BrowserAct** → https://youtu.be/Pb1GYAFVz1A
> 📚 Support de cours gratuit (Skool) : https://shorturl.at/gAGbV

## Comment ça marche

1. L'agent ouvre Google Maps avec un navigateur **anti-détection** (BrowserAct, mode stealth) — il passe le mur de consentement et la détection de bot.
2. Il liste les business, ouvre chaque fiche et récupère **site web + téléphone** (puis l'**email** sur le site).
3. Il analyse chaque site (HTTPS, responsive, SEO, Open Graph, perf…) et calcule un **score « site éclaté » (0-100)** — plus c'est haut, meilleur est le prospect.
4. Il écrit les leads dans **MongoDB**, et le **dashboard Next.js** les affiche en live.

Plusieurs navigateurs stealth = plusieurs agents en parallèle, chacun isolé (fingerprint / IP / cookies).

## Stack

- **Claude Code** (l'agent) + skill **`browser-act`**
- **BrowserAct** — Chromium anti-détection (mode stealth)
- **Next.js 16** + **shadcn/ui** (dashboard)
- **MongoDB** (stockage des leads)
- **Bun**

## Setup

```bash
# 1. Dépendances
bun install

# 2. Variables d'environnement
cp .env.example .env.local
# puis remplis MONGODB_URI et BROWSERACT_API_KEY

# 3. Le CLI BrowserAct (pour le scraping)
uv tool install browser-act-cli --python 3.12
browser-act auth set <ta-clé-app-...>

# 4. Lancer le dashboard
bun run dev
```

## Lancer une prospection

```bash
# Batch (orchestrateur)
bun run scripts/prospect.ts "plombier" "Aix-en-Provence" 20
```

Ou en mode agent : demande à Claude Code _« trouve-moi 20 plombiers à Aix »_ — il suit le playbook décrit dans [`AGENTS.md`](./AGENTS.md).

## Structure

- `scripts/prospect.ts` — orchestrateur de prospection (batch)
- `lib/maps-agent.ts` — pilotage du CLI browser-act (extraction Google Maps)
- `lib/site-analyzer.ts` — scoring « site éclaté »
- `lib/leads.ts` / `lib/mongodb.ts` — persistance MongoDB
- `app/` — dashboard Next.js (LeadHunter)
- `output/leadhunter/` — le skill Google Maps forgé par l'agent

---

Fait avec ❤️ par [Claude Code France](https://cc-france.org) 🇫🇷
