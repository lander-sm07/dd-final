# 📚 Deadlines: your school dashboard

A clean dashboard for all your deadlines, exams and to-dos, with reminders on your phone through Discord. It's free and works on your laptop and your phone.

**What you get**
- **Dashboard** with a calendar, the next 7 days, a "next up" countdown, to-dos, a focus timer, quick notes and course links
- **Quick add**: type `SKIL report friday 23:59` and it works out the course, day and time
- **Discord reminders**:
  - ☀️ 08:00 overview: overdue, today, tomorrow, next few days, and exams this week
  - 🌙 19:00 heads-up for everything due tomorrow
  - ⏰ 3 hours before a deadline (no time = 23:59)

**How it fits together:** the website runs on **GitHub Pages** and your tasks are stored in **Supabase** (behind a login, so only you can see them). Every hour **GitHub Actions** checks your deadlines and posts to your **Discord** server through a webhook. All of these are free.

---

## Setup (about 20 minutes, one time)

### 1. Put the code on GitHub
1. Make a free account on [github.com](https://github.com).
2. Click **+ → New repository**. Name it `deadlines`, set it to **Public**, and click **Create repository**.
3. On the new repository page, click **uploading an existing file**. Drag **everything inside this folder** in, including the `.github` folder, then click **Commit changes**.
   > If the `.github` folder doesn't show up after uploading, click **Add file → Create new file**, name it `.github/workflows/reminders.yml`, and paste in the contents of that file.

### 2. Turn on the website
1. In the repository, go to **Settings → Pages**.
2. Under *Branch*, pick **main** and **/ (root)**, then click **Save**.
3. After about a minute your site is live at `https://YOUR-USERNAME.github.io/deadlines/`.
   It starts in **demo mode**, with your Excel data stored in that browser only. Next you'll connect the database.

### 3. Create the database (Supabase)
1. Make a free account on [supabase.com](https://supabase.com) and click **New project**. Pick a region in the EU (for example Frankfurt) and choose any database password.
2. Go to **SQL Editor → New query**, paste in everything from `supabase/schema.sql`, and click **Run**.
3. Go to **Authentication → Users → Add user → Create new user**. Enter your email and a password, and tick **Auto confirm user**. This is your login.
4. Go to **Authentication → Sign In / Providers** and switch **off** "Allow new users to sign up", so nobody else can make an account.
5. Back in **SQL Editor**, run `supabase/import.sql`. This adds the deadlines from your Excel file.
6. Go to **Project Settings → API Keys** and keep this page open. You need:
   - the **Project URL** (`https://xxxx.supabase.co`, shown under *Data API* or on the project home page)
   - the **anon / publishable** key. This one is safe to put on the website.
   - the **service_role / secret** key. Keep this one **secret**: it only goes into GitHub Secrets (step 5).

### 4. Connect the website to the database
1. On GitHub, open `js/config.js` and click the ✏️ pencil icon.
2. Fill in `NAME`, `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then click **Commit changes**.
3. Wait about a minute and open your site. You should now see a login screen. Sign in, and your data now syncs across all your devices.

### 5. Discord reminders
1. In your Discord server, make a channel like `#deadlines`.
2. Open its settings: **Edit Channel → Integrations → Webhooks → New Webhook → Copy Webhook URL**.
3. *(Optional, recommended)* To get @mentioned so your phone always buzzes: go to Discord **Settings → Advanced → Developer Mode** and turn it on. Then right-click your own name and choose **Copy User ID**.
4. On GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL |
   | `SUPABASE_SERVICE_KEY` | the **service_role / secret** key |
   | `DISCORD_WEBHOOK_URL` | the webhook URL |
   | `DISCORD_USER_ID` | your user ID (optional) |

5. *(Optional)* On the **Variables** tab, add `DASHBOARD_URL` with your site link. The morning overview will then link to it.
6. **Test it:** go to **Actions → Discord reminders → Run workflow → Run workflow**. Within about 30 seconds a morning overview should appear in Discord. 🎉

### 6. On your phone
- Install Discord and make sure notifications are on for your server (or at least for `#deadlines`).
- Open your dashboard and add it to your home screen. On iPhone: Safari → Share → **Add to Home Screen**. On Android: Chrome → ⋮ → **Add to Home screen**. It then opens full-screen like an app.

---

## Using it
- **Add something:** type in the bar at the top and press Enter. It understands:
  - course names (`SKIL`, `Linux Web`, …)
  - days: `today`, `tomorrow`, `friday`, `next wed`, `12 dec`, `12/12`, `in 3 days` (Dutch works too: `morgen`, `vrijdag`)
  - times: `23:59`, `14u`, `9pm`
  - `exam` or `test` makes it an exam, `todo` makes it a to-do, and `!` marks it important

  The ⚙️ button next to the bar opens the full form.
- Press **N** anywhere to jump to the add bar.
- Click a task to edit it. Click the circle to tick it off (you can undo). ⭐ marks it important.
- In the **Courses** page you can set the Canvas link and colour for each course.

## Good to know
- **Free tiers:** Supabase pauses free projects after about a week with no activity. The hourly reminder job keeps it awake, so you shouldn't notice.
- **GitHub on public repositories:** if the repository has no changes for 60 days (for example over summer), GitHub pauses scheduled jobs and emails you. One click under **Actions** turns them back on.
- **Adding features later:** just ask Claude. Send the file(s) or describe what you want (grades, exam countdown, study planner, …).

## Files
```
index.html, css/, js/          the website
js/config.js                   your settings (URL + public key + name)
js/seed.js                     your Excel data, only used in demo mode
supabase/schema.sql            database tables + security rules
supabase/import.sql            one-time import of your Excel deadlines
scripts/remind.mjs             the reminder logic
.github/workflows/reminders.yml   runs the reminders every hour
```
