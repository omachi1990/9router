# 9Router Cloud Worker

Deploy your own Cloudflare Worker to access 9Router from anywhere.

## Setup

```bash
# 1. Install dependencies
cd cloud
npm install

# 2. Login to Cloudflare
npx wrangler login

# 3. Deploy
# Wrangler 4.45+ provisions KV and D1 automatically when IDs are omitted.
npm run deploy

# 4. Init the D1 database after the first deploy/provision
npx wrangler d1 execute proxy-db --remote --file=./migrations/0001_init.sql
```

Copy your Worker URL → 9Router Dashboard → **Endpoint** → **Setup Cloud** → paste → **Save** → **Enable Cloud**.
