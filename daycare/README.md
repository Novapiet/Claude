# Daycare Duty

A small app for two parents to plan who handles daycare **drop-off (morning)** and
**pickup (evening)** each day. Works on any phone, installs as an app, works offline,
and syncs between both of you through a private GitHub repo.

**Open the app:** https://novapiet.github.io/claude/daycare/

## How it works

- Each weekday shows two slots: 🌅 **Drop-off** and 🌙 **Pickup**.
- **Tap a slot** to cycle who owns it: Parent 1 → Parent 2 → nobody → back to your usual schedule.
- Set your **typical week** once in Settings (⚙) — every day auto-fills from it
  (shown with a dashed border and "usual" tag), and you only tap to override exceptions.
- The **month balance bar** shows how the load splits between you two.

## One-time setup to share with your partner

The schedule data lives in a **private GitHub repo** that only the two of you can
access. Setup takes ~5 minutes:

### 1. Create a private data repo (one of you does this)

1. On github.com, create a new repository, e.g. `daycare-data`.
2. Set it to **Private**. That's it — no files needed.
3. Invite your partner as a collaborator (Settings → Collaborators), *or* just
   share one token with them (see below).

### 2. Create an access token (each of you, or share one)

1. Go to GitHub → Settings → Developer settings →
   [Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. **Repository access:** "Only select repositories" → pick `daycare-data`.
3. **Permissions:** Repository permissions → **Contents → Read and write**. Nothing else.
4. Set a long expiration, generate, and copy the token (`github_pat_...`).

Because the token is scoped to only that one empty repo with only Contents access,
it can't touch anything else in your GitHub account.

### 3. Connect both phones

1. Open the app, tap ⚙ → **Sync with your partner**.
2. Enter the repo as `yourusername/daycare-data` and paste the token.
3. Tap **Connect & Sync**. Do the same on your partner's phone.

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
