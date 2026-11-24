# Multi-Site Lead Management Dashboard

A production-ready multi-site lead management dashboard built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase (`@supabase/supabase-js` v2)**, ready for deployment on **Vercel**.

## Features

- **Supabase Auth**: Email/password sign-in at `/login`. All application routes require an authenticated session.
- **Multi-Site Architecture**: Driven dynamically by the `sites` table (`domains`, `inboxes`, `match_keywords`, `exclude_keywords`, `channels`, `dashboard_fields`, `contact_options`, `color`, `active`, `show_on_dashboard`).
- **Dashboard Analytics**: Per-site or cross-site status counts, high-priority open leads, today/week/month volume, 30-day daily trend chart, channel & primary service breakdowns, and top countries.
- **Leads Table**: Dynamic columns from the selected site's `dashboard_fields`, comprehensive filters (site, status, priority, channel, division, country, date range, text search), server-side pagination (50/page), bulk status updates, and CSV export.
- **Lead Detail Drawer**: Full message, `extra` JSON key/value viewer, inline status updates, persistent notes, site reassignment (`site_id` + `site_name`), and dynamic site-configured **Contact** actions (`email`, `phone`, `whatsapp`, `sms`, `calendly`, `link`, `custom`) with placeholder interpolation and a prompt to mark `"New"` leads as `"Contacted"`.
- **Kanban Pipeline**: 6 status columns with drag-and-drop status transitions, site filter, and high-priority badges.
- **Sites Manager & Rule Tester**: Full CRUD for `sites`, tag inputs, drag-to-reorder `dashboard_fields`, live-preview `contact_options` builder, and an interactive **Test Rules** simulator replicating the n8n matching & scoring algorithm.
- **Supabase Realtime**: Live `postgres_changes` subscriptions on `leads` (`INSERT` and `UPDATE`) with toast alerts (emphasized for `high` priority leads).

---

## 1. Environment Setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Set your Supabase credentials in `.env.local`:

   ```env
   VITE_SUPABASE_URL=https://vthwyphvwqowqjdanras.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

   You can find your **Project URL** and **anon public key** in the Supabase Dashboard under **Project Settings -> API**.

3. Install dependencies and start the local development server:

   ```bash
   npm install
   npm run dev
   ```

   The app runs at `http://localhost:3000`.

---

## 2. Creating the First Dashboard User in Supabase Auth

Because all dashboard routes require an authenticated Supabase session:

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication -> Users** in the left sidebar.
3. Click **Add user -> Create new user**.
4. Enter the user's **Email** and **Password**, and keep **Auto Confirm User** checked so they can sign in immediately without waiting for a confirmation email.
5. Click **Create user**.
6. Ensure your Row Level Security (RLS) policies on `sites` and `leads` grant `SELECT`, `INSERT`, `UPDATE`, and `DELETE` to the `authenticated` role, and enable **Realtime** (`supabase_realtime` publication) for the `leads` table under **Database -> Publications**.

---

## 3. Deploying to Vercel

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Go to [Vercel](https://vercel.com) and click **Add New -> Project**, then import your repository.
3. Keep the detected **Vite** framework preset:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Expand **Environment Variables** in Vercel Project Settings and add both:
   - `VITE_SUPABASE_URL` = `https://vthwyphvwqowqjdanras.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
5. Click **Deploy**. The included `vercel.json` handles SPA rewrites so client-side routes (`/login`, `/kanban`, `/sites`, etc.) resolve cleanly on refresh.

---

## 4. n8n Webhook Note

Website form submissions targeting `https://jungle4324.app.n8n.cloud/webhook/expat-tax-lead-intake` will begin flowing into `leads` automatically once the n8n workflow is activated/live.
"# sohaib1" 
