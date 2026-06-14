# Daycare Duty

A small app for two parents to plan who handles daycare **drop-off (morning)** and
**pickup (evening)** each day. Works on any phone, installs as an app, works offline,
and syncs between both of you through a private GitHub repo.

**Open the app:** https://novapiet.github.io/Claude/daycare/
(note the capital **C** — the address is case-sensitive)

## How it works

- Each weekday shows two slots: 🌅 **Drop-off** and 🌙 **Pickup**.
- **Tap a slot** to cycle who owns it: Parent 1 → Parent 2 → nobody → back to your usual schedule.
- Set your **typical week** once in Settings (⚙) — every day auto-fills from it
  (shown with a dashed border and "usual" tag), and you only tap to override exceptions.
- The **month balance bar** shows how the load splits between you two.

## One-time setup to share with your partner

The schedule data lives in a **private GitHub repo** that only the two of you can
access. Setup takes ~5 minutes:

### 1. Create a private data repo (just ONE of you does this)

1. On github.com, create a new repository, e.g. `daycare-data`.
2. Set it to **Private**.
3. **Tick "Add a README file"** before creating. (This gives the repo an initial
   commit so the app can write to it right away.)

Only one of you makes this repo — say it's on **your** account, `yourname/daycare-data`.

### 2. Create ONE access token and share it with your partner

> **Important:** make the token on the **same account that owns the repo** (the one
> from step 1). A fine-grained token can only reach repos owned by the account that
> created it — so your partner cannot make their *own* token for your repo. You make
> one token and you both use it.

1. On that account, go to GitHub → Settings → Developer settings →
   [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. **Repository access:** "Only select repositories" → pick `daycare-data`.
3. **Permissions:** Repository permissions → **Contents → Read and write**. Nothing else.
4. Set a long expiration, generate, and copy the token (`github_pat_...`).

Because the token is scoped to only that one repo with only Contents access, it
can't touch anything else in the account.

### 3. Connect both phones

1. Open the app, tap ⚙ → **Sync with your partner**.
2. Repo: `yourname/daycare-data` (exactly as it appears on GitHub).
   Token: paste the `github_pat_...` from step 2.
3. Tap **Connect & Sync** — you should see "Synced ✓".
4. Do the **same** on your partner's phone: same repo, same token.

If you see an error instead, the message tells you what to fix — a **404** means
the repo name is off or the token belongs to the wrong account, **403** means the
token is missing Contents read/write, **401** means the token itself is wrong or expired.

Changes sync automatically a couple of seconds after you make them, and whenever
the app is opened. If you're both editing offline, the most recent change to each
individual slot wins.

### 4. (Optional) Set a family PIN

In Settings → **Family PIN**. The app then asks for the PIN whenever it's opened —
handy if the kids get hold of your phone. The PIN syncs, so it's the same on both phones.

## Install on your phone

- **iPhone:** open the link in Safari → Share → **Add to Home Screen**.
- **Android:** open the link in Chrome → menu → **Add to Home screen / Install app**.

## Privacy & security notes

- Your schedule is stored on your phone and in *your* private GitHub repo — nowhere else.
- The access token is stored only on the device where you enter it.
- The PIN is a convenience lock for the app UI; the real access control is the
  GitHub token. Don't post the token anywhere public.
