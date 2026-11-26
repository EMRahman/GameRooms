# GameRooms

Play Dots and Boxes or Fourfold in your browser. Create a room and send a friend the invite
link or let them scan its QR code.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2FEMRahman%2FGameRooms)

The button deploys the game pages, API and two SQLite-backed Durable Objects as
one Worker on Workers Free. Open the new `workers.dev` URL to play. The button becomes usable once this source is in the public repository it
links to. If you publish elsewhere, update the button URL.

Each deployment allows up to 10 new rooms per UTC day, with a default limit of
three per network per hour. Set the optional `OWNER_KEY` Worker secret if the
deployment owner needs to create rooms beyond these limits. Enter it under
**Owner key** in the create form. Owner-created rooms count toward the daily
total.

## Local development

With Node.js 24 or later, run `npm install`, then `npm run dev`. Use two separate browser profiles to
join the same room locally. Run `npm test` for the game, room and quota tests.
