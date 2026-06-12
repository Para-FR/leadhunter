# LeadHunter — Agent de prospection

Ce projet est **LeadHunter** : un agent IA qui trouve des prospects commerciaux en
scrapant Google Maps, en analysant la santé de leur site web, et en scorant ceux qui
ont besoin d'une refonte (« sites éclatés »).

## Ta mission quand on te demande de prospecter

Quand l'utilisateur dit quelque chose comme *« trouve-moi 20 plombiers à Roubaix »*,
*« prospecte les restaurants à Lyon »*, etc., tu joues le rôle de l'**agent de
prospection**. Deux façons de faire :

1. **Batch fiable (recommandé par défaut)** — lance l'orchestrateur :
   ```bash
   bun run scripts/prospect.ts "<métier>" "<zone>" [limit]
   # ex : bun run scripts/prospect.ts "plombier" "Roubaix" 5
   # env optionnel : BROWSER_ID=<id navigateur stealth>  (défaut leadhunt-fr-1 = 98129092535983650)
   ```
   Il scrape Maps, résout les sites, score, et écrit les leads dans MongoDB (collections
   `campaigns` / `leads`). Le dashboard (`bun run dev`) les affiche en live.

2. **En direct (mode démo / vidéo)** — pilote toi-même le navigateur via le **skill
   `browser-act`** en suivant le playbook ci-dessous. Pour le tournage, ouvre les
   navigateurs en **`--headed`** pour qu'on voie l'agent travailler.

> **Pour TOUTE action sur le web (ouvrir un site, scraper, passer un captcha/consentement,
> naviguer), utilise le skill `browser-act`.** Ne te repose pas sur `fetch`/WebFetch :
> les sites comme Google Maps ont de l'anti-bot et te bloqueront. browser-act donne un
> vrai navigateur stealth, isolé, et permet de tourner en parallèle.

## Playbook browser-act (mode direct)

1. **Ouvrir** : `browser open <id> https://www.google.com/maps/search/<métier+zone>` (type stealth).
2. **Consentement** : si l'URL est sur `consent.google.*`, **lis l'état de la page**,
   repère le bouton par son `aria-label` (« Tout accepter ») et clique — ne jamais
   présumer un index figé (la page change).
3. **Lister** (via `eval`, sélecteurs stables) :
   `document.querySelectorAll('a.hfpxzc')` → `aria-label` (nom) + `href` (fiche).
4. **Détail** : pour chaque fiche, `navigate` vers le href puis `eval` :
   - site web : `a[data-item-id="authority"]`
   - téléphone : `button[data-item-id^="phone"]`
   - note : `div.F7nice`
5. **Analyser** chaque site avec `analyzeSite()` (`lib/site-analyzer.ts`).
6. **Écrire** les leads dans MongoDB (`lib/leads.ts`).

Parallélisme : plusieurs navigateurs stealth = plusieurs agents en parallèle, chacun
isolé (fingerprint/IP/cookies). Navigateurs déjà créés : `leadhunt-fr-1`
(98129092535983650), `leadhunt-fr-2` (98129095417470754). Quota stealth : 5.

## Grille de score « site éclaté » (0-100, + haut = + prospect)

Pas de site = 100 · injoignable · pas de HTTPS · pas responsive (pas de `<meta viewport>`)
· pas de `<title>`/meta description (SEO) · pas d'Open Graph · builder daté · page quasi
vide / « en construction » · chargement lent. Logique dans `lib/site-analyzer.ts`.

## Fichiers clés

- `scripts/prospect.ts` — orchestrateur agent (batch)
- `lib/maps-agent.ts` — pilotage du CLI browser-act (eval, extraction)
- `lib/site-analyzer.ts` — scoring « éclaté »
- `lib/leads.ts` — persistance Mongo (campaigns / leads)
- `app/` — dashboard Next.js (LeadHunter)
- `output/leadhunter/` — le skill Google Maps forgé par l'agent

## Conventions

- MongoDB : base `browseractpoc` (URI dans `.env.local`).
- BrowserAct : clé dans `.env.local` ; le CLI est authentifié localement (`browser-act auth`).
- Lancer le dashboard : `bun run dev`. Build : `bun run build`.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
