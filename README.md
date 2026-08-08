# kytchens-restaurant-monitor

CI shell for the Kytchens fleet monitor (Swiggy/Zomato live status + menu tracking).

The application code — scrapers, parsers, dashboard, and database migrations — lives
in a **private** repository. This public repository exists only to run the scheduled
GitHub Actions workflows on public-repo runner minutes; each job checks the private
code out at run time using a read-only deploy key (stored as the `CORE_DEPLOY_KEY`
secret). No application source, configuration, or credentials are kept here.

## Workflows

- **Restaurant Monitor** (`.github/workflows/scrape.yml`) — runs every 30 minutes
  (and on manual dispatch): syncs the restaurant config, shards the outlet list, and
  scrapes each shard's Swiggy/Zomato status into Supabase.
- **Deploy Dashboard** (`.github/workflows/deploy-dashboard.yml`) — manual dispatch;
  deploys the monitor dashboard to Vercel.
