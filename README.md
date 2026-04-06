# emdash-plugin-lettermint

[Lettermint](https://lettermint.co) email provider plugin for [EmDash CMS](https://emdashcms.com).

Sends all EmDash emails (password resets, notifications, etc.) through Lettermint's EU-based email delivery service.

## Installation

```bash
npm install @jdevalk/emdash-plugin-lettermint
```

Add it to your Astro config:

```typescript
import { defineConfig } from "astro/config";
import emdash from "emdash";
import lettermintPlugin from "@jdevalk/emdash-plugin-lettermint";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [lettermintPlugin()],
    }),
  ],
});
```

## Configuration

In the EmDash admin panel, go to the Lettermint plugin settings and configure:

- **API token** — your Lettermint API token from [dash.lettermint.co](https://dash.lettermint.co)
- **From address** — your default sender address (e.g. `You <you@yourdomain.com>`)

## Requirements

- A [Lettermint](https://lettermint.co) account with a verified sending domain
- An API token from your Lettermint dashboard

## How it works

This plugin registers as an EmDash email provider using the `email:deliver` hook. When any part of EmDash (or another plugin) sends an email, Lettermint handles the delivery.

The plugin uses only the EmDash plugin API — no Cloudflare-specific code. It works on any platform EmDash supports.

## License

MIT
