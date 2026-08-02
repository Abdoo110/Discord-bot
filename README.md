# 🤖 Discord Bot — Full Setup Guide

## 📋 Features

### 🛡️ Moderation
- **/ban** — Ban a member with optional message deletion
- **/kick** — Kick a member
- **/timeout** — Timeout a member (10s to 28d)
- **/purge** — Bulk delete messages (1-100), optional user filter
- **/lock** — Lock a text channel (deny @everyone SendMessages)
- **/unlock** — Unlock a text channel
- **/strike** — Issue a strike/warning with auto‑incrementing case numbers
- **/snipe** — Retrieve the last deleted message

### ✅ Vouch System
- **/vouch** — Vouch for a trusted user (shows total vouches, scams, reputation)
- **/scamvouch** — Report a scam vouch

### ⚠️ Warning System
- **/warning** — Issue a formal warning with DM notification
- **/clearwarnings** — Clear all warnings for a user

### 👥 Staff Management
- **/hire** — Hire a new staff member (admin only)
- **/promotion** — Promote a staff member (admin only)
- **/demotion** — Demote a staff member (admin only)
- **/staffinfo** — Register your IGN & timezone
- **/finfo** — Force-check any staff member's info (mod+)
- **/loa** — Leave of Absence system (start / end / status)

### 📝 Message Tools
- **/stick** — Stick a message (re‑posts at bottom on new messages)
- **/unstick** — Remove stuck message
- **/echo** — Send a message as the bot
- **/activitycheck** — Role‑pinged activity check with ✅ reaction

### 🎉 Giveaways
- **/gcreate** — Create a giveaway (prize, duration, winners, requirements)
- **/gend** — End a giveaway early by message ID
- **/greroll** — Re‑roll winners for a completed giveaway
- **/gweekly** — Show weekly giveaway stats for all staff

### 🤝 Partner System
- **/psetup** — Set partner tracking channel
- **/unpsetup** — Disable partner tracking
- **/pleaderboard** — View partner leaderboard
- **/resetpartners** — Reset leaderboard (owner only)

### ⚡ Fun
- **/fast** — First to click ⚡ wins!

### 🔧 Configuration
- **/setchannel** — Configure log channels (mod, warning, vouch, staff, giveaway, bug reports, partner)
- **/setrole** — Configure roles (staff, admin, moderator, muted, activity)
- **/commands** — Show full command list

### 🐛 Bug Reports
- **/bugreport** or **!bugreport** — Submit a bug report to the configured channel

### 🛡️ Anti‑Abuse
- **Anti‑Spam** — Auto‑mutes users sending too many messages too fast
- **Anti‑Raid** — Detects mass user joins and locks down the server
- **Anti‑Nuke** — Detects mass channel deletion, role deletion, or bans and locks down

---

## 🚀 Setup Instructions

### Step 1: Prerequisites
- **Node.js** v18 or higher → https://nodejs.org/
- **MongoDB** → Free tier at https://www.mongodb.com/atlas
- A **Discord Bot Token** → https://discord.com/developers/applications

### Step 2: Create a Discord Application
1. Go to https://discord.com/developers/applications
2. Click **"New Application"** → name it
3. Go to **Bot** tab → click **"Add Bot"**
4. Enable these privileged intents:
   - ✅ **Message Content Intent**
   - ✅ **Server Members Intent**
5. Copy the **Token** and keep it safe
6. Copy the **Client ID** from **OAuth2 → General**

### Step 3: Invite the Bot
Go to **OAuth2 → URL Generator**:
- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Administrator` (or manually select all)
- Open the generated URL and invite the bot to your server

### Step 4: Set Up MongoDB
1. Go to https://www.mongodb.com/atlas → sign up
2. Create a **free cluster** (M0)
3. Go to **Database Access** → add a user (username + password)
4. Go to **Network Access** → add `0.0.0.0/0` (allow from anywhere)
5. Go to **Clusters** → **Connect** → **Drivers**
6. Copy the connection string. It looks like:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `username` and `password` with the ones you created
8. Add `discord-bot` before `?` → `mongodb+srv://...mongodb.net/discord-bot?retryWrites=...`

### Step 5: Configure `.env`
Copy `.env.example` to `.env` and fill in:
```
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/discord-bot
BOT_INVITE=your_bot_invite_link
```

### Step 6: Install & Deploy
```bash
cd discord-bot
npm install
npm run deploy   # Register slash commands
npm start        # Start the bot
```

### Step 7: Configure Channels (in Discord)
```
/setchannel type:Mod Logs channel:#mod-logs
/setchannel type:Warning Logs channel:#warnings
/setchannel type:Vouch Logs channel:#vouches
/setchannel type:Staff Logs channel:#staff
/setchannel type:Giveaway Logs channel:#giveaway-logs
/setchannel type:Bug Reports channel:#bug-reports
/setchannel type:Partner Channel channel:#partners
```

### Step 8: Configure Roles (in Discord)
```
/setrole type:Staff Role role:@Staff
/setrole type:Admin Role role:@Admin
/setrole type:Moderator Role role:@Moderator
```

---

## 🖥️ 24/7 Hosting Options

### Option A: Railway (Recommended — Free Tier)
1. Push the bot to GitHub
2. Go to https://railway.app → **New Project** → **Deploy from GitHub**
3. Add environment variables (TOKEN, CLIENT_ID, MONGODB_URI)
4. Set start command: `npm start`

### Option B: Fly.io (Free Tier)
```bash
fly launch
fly secrets set TOKEN=xxx CLIENT_ID=xxx MONGODB_URI=xxx
fly deploy
```

### Option C: Cheap VPS ($2-5/month)
- Buy a VPS from DigitalOcean, Vultr, or Hetzner
- Install Node.js, clone the bot, use `pm2` to keep it alive:
```bash
npm install -g pm2
pm2 start src/index.js --name discord-bot
pm2 save
pm2 startup
```

---

## 📊 File Structure
```
discord-bot/
├── src/
│   ├── index.js              ← Main entry point
│   ├── deploy-commands.js    ← Deploy slash commands
│   ├── config.js             ← Bot configuration
│   ├── commands/
│   │   ├── moderation/       ← ban, kick, timeout, purge, lock, unlock, strike, snipe
│   │   ├── vouch/            ← vouch, scamvouch
│   │   ├── warning/          ← warning, clearwarnings
│   │   ├── staff/            ← hire, promotion, demotion, staffinfo, finfo, loa
│   │   ├── messages/         ← stick, unstick, echo, activitycheck
│   │   ├── giveaway/         ← gcreate, gend, greroll, gweekly
│   │   ├── partner/          ← psetup, unpsetup, pleaderboard, resetpartners
│   │   ├── fun/              ← fast
│   │   └── utility/          ← commands, bugreport, setchannel, setrole
│   ├── events/               ← Event handlers (messages, prefix commands)
│   ├── handlers/             ← Command loader, anti-abuse
│   ├── models/               ← MongoDB schemas
│   └── utils/                ← Embed builder, permissions, helpers
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Prefix Commands (`!` by default)
| Command | Description |
|---------|-------------|
| `!ban @user [reason]` | Ban a user |
| `!kick @user [reason]` | Kick a user |
| `!timeout @user 10m [reason]` | Timeout a user |
| `!snipe` | Snipe deleted message |
| `!lock` | Lock the channel |
| `!unlock` | Unlock the channel |
| `!bugreport <description>` | Submit bug report |

---

## ❓ Need Help?
If you run into issues, use `/bugreport` in your Discord server or check the console logs. All errors are caught and logged — the bot will not crash on unexpected errors.
