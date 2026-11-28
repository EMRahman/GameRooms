# Team Side Quests

[![Friends around the globe playing together on phones, tablets, and laptops](public/world-play.jpg)](https://gamerooms.ehsanr-web.workers.dev/)

**▶ Play now: [Cloudflare](https://gamerooms.ehsanr-web.workers.dev/) · [GitHub Pages](https://emrahman.github.io/GameRooms/)**

*One game, every time zone.* Quick multiplayer games for friends, whether it’s afternoon where you are and evening where they are. No account needed: open the page in a browser on your phone, tablet, or computer. Both links use the same Cloudflare Worker for rooms, so they share the same room limits.

## How it works

1. **Pick a game** and choose its settings.
2. **Create a room.**
3. **Invite friends** with the room code, invite link, or QR code. Each room has its own chat.

## Games

These eight games come from the original [Side Quest arcade](https://emrahman.github.io/Games/).

| Game | Players | What you do |
|---|---|---|
| **Boxed In** | 2 | Claim squares by drawing the edges. |
| **Fourfold** | 2 | Connect four counters in a row. |
| **Go** | 2 | Surround territory on a shared board. |
| **Memory Match** | 2–5 | Find matching pairs. |
| **Northstar** | 2 | Find and sink your opponent’s fleet. |
| **Iron Routes** | 2–5 | Build a rail network across North America, Europe, Asia, South America, the Middle East, Australia, or Switzerland, with tunnels and stations. |
| **Landlord** | 2–6 | Trade properties and compete for wealth. |
| **Conquest** | 2–6 | Vie for control of the map. |

## Deploy your own

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FEMRahman%2FGameRooms)

The button deploys the game pages, API, and two SQLite-backed Durable Objects as one Worker on Workers Free. When it finishes, open your `workers.dev` address, create a room, and share the code or invite link.

### Room limits

Each deployment allows up to **10 new rooms per UTC day**, and by default **three rooms per network per hour**. To create rooms beyond those limits, set the optional `OWNER_KEY` Worker secret, then enter it under **Have an owner key?** when you set up a room. Owner-created rooms still count toward the daily total.

## Develop locally

You need Node.js 24 or later:

```sh
npm install
npm run dev
```

If the default future compatibility date causes a local startup error with the pinned Wrangler version, run `npm run dev -- --compatibility-date 2026-09-30`.

To join the same room locally, use two separate browser profiles. Run `npm test` to run the game, room, and quota tests.
