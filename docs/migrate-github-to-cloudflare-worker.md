# Migrate Wealthlanding from GitHub Pages to Cloudflare Worker

This runbook is for **Wealthlanding** (`wealthlanding.com`): a static HTML site in GitHub that should be served by a **Cloudflare Worker with static assets**, not Cloudflare Pages and not “Cloudflare proxy in front of GitHub Pages.”

It is **instructions only**. Follow the steps yourself in the Cloudflare and Namecheap dashboards. Do **not** wipe the whole DNS zone. Keep mail and verification records. Only **change** the web records (apex and `www`) when you are ready to cut traffic over.

---

## What “done” looks like

| Check | Expected |
|--------|----------|
| Git deploy | Worker `wealthlanding` builds from `Jzhang1011/Wealthlanding` on `main` |
| Preview | `https://wealthlanding.<your-subdomain>.workers.dev` loads the site |
| Config | Root `wrangler.jsonc` with `assets.directory` set to `./` |
| Live site | `https://www.wealthlanding.com` and `https://wealthlanding.com` served by the Worker |
| DNS | Apex + `www` point at the Worker / Cloudflare, **not** `*.github.io` or GitHub Pages IPs |
| GitHub Pages | Custom domain disconnected (or Pages off) so it does not fight Cloudflare |
| SSL | SSL/TLS mode **Full (strict)** |
| Other DNS | MX, TXT (SPF/DKIM), and unrelated records **unchanged** |

---

## What this is *not*

- **Not Cloudflare Pages** (“Workers & Pages → Create → Pages → Connect to Git”). Wealthlanding uses a **Worker** + `wrangler.jsonc` assets.
- **Not** “orange-cloud proxy to GitHub Pages.” Do **not** set apex A/AAAA to `185.199.*` / `2606:50c0:*` or `www` CNAME to `YOURUSER.github.io` if the Worker should be primary.
- **Not** deleting every DNS record. Update only what serves the website.

---

## Before you start

1. Cloudflare account with zone **wealthlanding.com** (DNS already on Cloudflare, or you will point Namecheap nameservers in Step 1).
2. GitHub repo **Jzhang1011/Wealthlanding** (static HTML on `main`, with `index.html` at repo root).
3. Repo already has (or you will add) root **`wrangler.jsonc`** like:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "wealthlanding",
  "compatibility_date": "2026-09-22",
  "assets": {
    "directory": "./",
    "not_found_handling": "404-page"
  }
}
```

4. Optional: add a root `404.html` if you use `not_found_handling: "404-page"`.
5. Namecheap login for the domain (only needed if nameservers are not already Cloudflare).

---

## Step 1 — Domain on Cloudflare (Namecheap nameservers)

Skip this if `wealthlanding.com` already appears in Cloudflare and DNS is managed there.

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Add site **wealthlanding.com** (or open the existing zone).
3. Choose a plan (Free is enough for this static site).
4. Cloudflare shows **two nameservers** for *your* account (examples only — **copy yours**, do not copy someone else’s):
   - `*.ns.cloudflare.com`
   - `*.ns.cloudflare.com`
5. In **Namecheap** → Domain List → **wealthlanding.com** → **Domain** → Nameservers:
   - Switch **BasicDNS** → **Custom DNS**.
   - Paste the two Cloudflare nameservers Cloudflare showed you.
   - Save.
6. Wait until Cloudflare marks the zone **Active** (can take minutes to a day).

**Do not delete DNS records wholesale** when the zone activates. Cloudflare may import existing records. You will adjust **only** web records in Step 5.

---

## Step 2 — Create / confirm the Worker from GitHub

1. Cloudflare Dashboard → **Compute (Workers)** → **Workers & Pages** (wording may be **Workers**).
2. If Worker **`wealthlanding`** already exists and is connected to `Jzhang1011/Wealthlanding`, skip to Step 3.
3. Otherwise **Create** → create a Worker connected to **Git**:
   - Authorize GitHub.
   - Select repo **Jzhang1011/Wealthlanding**.
   - Production branch: **`main`**.
4. Build settings for plain HTML:

   | Field | Value |
   |--------|--------|
   | Build command | *(empty / None)* |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |

5. Save. Confirm the first deploy reaches **Success**.

If deploy fails with **Missing entry-point to Worker script or to assets directory**, `wrangler.jsonc` is missing or not on `main` — merge that file first, then retry deploy.

---

## Step 3 — Verify the Worker preview URL

1. Open the Worker → overview.
2. Visit the `*.workers.dev` URL (for example `https://wealthlanding.<account>.workers.dev`).
3. Confirm homepage, `/investment/`, and `/investment/bitcoin.html` load.

Only continue to custom domains after preview looks correct.

---

## Step 4 — Attach custom domains on the Worker (preferred cutover)

This is the safest way to point the site at the Worker **without manually inventing IPs**.

1. Worker **wealthlanding** → **Domains** (or **Settings → Domains & Routes**).
2. **Add** custom domain: `www.wealthlanding.com`.
3. **Add** custom domain: `wealthlanding.com` (apex).
4. When Cloudflare offers to **update DNS for you**, review the proposed changes:
   - It should change **only** the records needed for those hostnames.
   - It should **not** remove MX/TXT/mail records.
5. Confirm / activate.

After this, check **DNS → Records** (Step 5) and confirm apex + `www` no longer target GitHub Pages.

---

## Step 5 — Review DNS (change web records only)

Go to Cloudflare → **wealthlanding.com** → **DNS** → **Records**.

### Keep (do not delete)

- **MX** (email)
- **TXT** (SPF, DKIM, domain verification, etc.)
- Any non-web hostnames you still use

### Web records — what “Worker primary” should look like

After Step 4, you typically want:

| Type | Name | Target / content | Proxy |
|------|------|------------------|--------|
| Whatever Cloudflare created for the Worker custom domain | `@` (apex) | Cloudflare-managed target for the Worker | Proxied (orange) |
| CNAME or Cloudflare-managed | `www` | Worker / same zone target Cloudflare set | Proxied (orange) |

### What to stop using for the live site

If these still exist for the **website**, **edit or replace** them (do not “delete the whole DNS page”):

| Type | Name | Content that means “still on GitHub Pages” |
|------|------|---------------------------------------------|
| A | `@` | `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::` … GitHub Pages v6 ranges |
| CNAME | `www` | `jzhang1011.github.io` or `*.github.io` |

**How to change without “wiping DNS”:**

1. Prefer Step 4 (Add custom domain) so Cloudflare rewrites the right rows.
2. Or **edit** the `www` CNAME and apex A/AAAA rows to the targets Cloudflare shows for the Worker custom domain.
3. Remove **only** duplicate leftover GitHub Pages A/AAAA/CNAME rows for `@` / `www` after the new Worker records work.

### SSL

**SSL/TLS** → **Overview** → encryption mode **Full (strict)**.

Avoid **Flexible** with a proxied origin; it often causes redirect loops or blank pages.

---

## Step 6 — Disconnect GitHub Pages from the custom domain

So GitHub stops fighting Cloudflare for the same hostnames:

1. GitHub → **Jzhang1011/Wealthlanding** → **Settings** → **Pages**.
2. Clear / remove **Custom domain** (`www.wealthlanding.com` or `wealthlanding.com`).
3. Optionally disable Pages if you no longer need `*.github.io` previews.
4. In the repo, the root **`CNAME`** file (if it still says `www.wealthlanding.com`) is for GitHub Pages. After cutover it is optional; remove or stop relying on it for production traffic so nobody re-enables Pages against the live names by mistake.

---

## Step 7 — Verify production

Wait 1–5 minutes (DNS/cache). Use a private/incognito window:

1. `https://www.wealthlanding.com`
2. `https://wealthlanding.com`
3. A deep link, e.g. `https://www.wealthlanding.com/investment/bitcoin.html`

Optional checks:

- Cloudflare Worker → **Deployments**: latest `main` deploy is **Success**.
- DNS for `@` and `www` no longer show GitHub Pages targets.

---

## Optional: apex ↔ www redirect

If you want one canonical host (recommended: `www`, matching the old Pages CNAME):

1. Cloudflare → **wealthlanding.com** → **Rules** → Redirect Rules.
2. Add a rule: `wealthlanding.com/*` → `https://www.wealthlanding.com/$1` (301), or the reverse if you prefer apex.

---

## Optional later: backend on Cloudflare

This site is static assets on a Worker today.

- **Do not** assume a Pages `functions/` folder is wired up unless you migrate the project type to Pages.
- For APIs later, add a Worker script / separate Worker routes, or revisit Pages + Functions as a **different** architecture.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---------|----------------|------------|
| Deploy: missing entry-point / assets directory | No `wrangler.jsonc` on `main` | Merge assets config; redeploy |
| `workers.dev` works, real domain shows old site | DNS still on GitHub Pages | Finish Steps 4–5; confirm records |
| Real domain works but GitHub still “owns” domain in UI | Pages custom domain still set | Step 6 |
| Redirect loop / blank page | SSL **Flexible** + proxy | Set **Full (strict)** |
| Mail breaks after “DNS cleanup” | MX/TXT deleted by mistake | Restore MX/TXT from registrar/Cloudflare history; never delete non-web records for a web cutover |

---

## Short checklist (print / copy)

- [ ] Zone active on Cloudflare (Namecheap Custom DNS → *your* CF nameservers if needed)
- [ ] Worker connected to GitHub `main`, deploy **Success**
- [ ] `wrangler.jsonc` on `main` with `assets.directory: "./"`
- [ ] Preview `*.workers.dev` looks good
- [ ] Custom domains `www` + apex added on the Worker
- [ ] DNS: apex + `www` updated for Worker; **MX/TXT kept**
- [ ] No leftover GitHub Pages A/AAAA/`github.io` for live web hostnames
- [ ] SSL **Full (strict)**
- [ ] GitHub Pages custom domain removed
- [ ] Incognito check of www, apex, and one deep link

---

*Wealthlanding-specific runbook. Instructions for a human operator — not an automated DNS wipe.*
