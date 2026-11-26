# Team Side Quests

[![Friends playing across devices on a dark arcade map](public/world-play.svg)](#play)

Turn a quick game into a shared side quest. Pick a game, create a room, then invite friends with its room code, link, or QR code. Join from your browser on any device.

These eight multiplayer games come from the original [Side Quest arcade](https://emrahman.github.io/Games/).

- **Boxed In** — claim squares by drawing the edges.
- **Fourfold** — connect four counters in a row.
- **Go** — surround territory on a shared board.
- **Memory Match** — find matching pairs.
- **Northstar** — find and sink your opponent’s fleet.
- **Iron Routes** — build a rail network and compete for points.
- **Landlord** — trade properties and compete for wealth.
- **Conquest** — vie for control of the map.

## Play

Deploy a copy with the button below. When deployment finishes, open its `workers.dev` address, create a room, and share the room code or invite link.

Play on [Cloudflare](https://gamerooms.ehsanr-web.workers.dev/) or [GitHub Pages](https://emrahman.github.io/GameRooms/). Both use the Cloudflare Worker for rooms and share its room limits.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FEMRahman%2FGameRooms)

The button deploys the game pages, API, and two SQLite-backed Durable Objects as one Worker on Workers Free.

## Room limits

Each deployment allows up to **10 new rooms per UTC day**, with a default limit of **three rooms per network per hour**. To create rooms beyond those limits, set the optional `OWNER_KEY` Worker secret and enter it under **Owner key** in the create panel’s settings. Owner-created rooms still count toward the daily total.

## Develop locally

With Node.js 24 or later:

```sh
npm install
npm run dev
```

With the pinned Wrangler version, use `npm run dev -- --compatibility-date 2026-09-30` if the default future compatibility date causes a local startup error.

Use two separate browser profiles to join the same room locally. Run `npm test` for the game, room, and quota tests.
