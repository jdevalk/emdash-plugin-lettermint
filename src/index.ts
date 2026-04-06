import { definePlugin } from "emdash";
import type { PluginContext, PluginDescriptor, RouteContext } from "emdash";
import { Lettermint } from "lettermint";

interface EmailDeliverEvent {
  message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  };
  source: string;
}

/**
 * Helper to read plugin settings from KV.
 */
async function getSettings(kv: PluginContext["kv"]) {
  const entries = await kv.list("settings:");
  const settings: Record<string, string> = {};
  for (const { key, value } of entries) {
    const k = key.replace("settings:", "");
    settings[k] = typeof value === "string" ? value : String(value);
  }
  return settings;
}

/**
 * Delivers an email via the Lettermint SDK.
 */
async function deliverHandler(event: EmailDeliverEvent, ctx: PluginContext) {
  const settings = await getSettings(ctx.kv);
  const { apiToken, fromAddress } = settings;

  if (!apiToken) {
    ctx.log.error("Lettermint API token not configured");
    return;
  }

  if (!fromAddress) {
    ctx.log.error("Lettermint from address not configured");
    return;
  }

  const client = new Lettermint({ apiToken });

  let email = client.email
    .from(fromAddress)
    .to(event.message.to)
    .subject(event.message.subject)
    .text(event.message.text);

  if (event.message.html) {
    email = email.html(event.message.html);
  }

  const response = await email.send();
  ctx.log.info(`Email delivered via Lettermint: ${response.message_id}`);
}

export function lettermintPlugin(): PluginDescriptor {
  return {
    id: "lettermint",
    version: "0.3.0",
    format: "native",
    entrypoint: new URL("./index.ts", import.meta.url).pathname,
    adminEntry: new URL("./admin.tsx", import.meta.url).pathname,
    adminPages: [
      { path: "/settings", label: "Lettermint", icon: "settings" },
    ],
    options: {},
  };
}

export function createPlugin() {
  return definePlugin({
    id: "lettermint",
    version: "0.3.0",
    capabilities: ["email:provide"],

    hooks: {
      "email:deliver": {
        exclusive: true,
        handler: deliverHandler,
      },
    },

    routes: {
      "settings": {
        handler: async (ctx: RouteContext) => {
          const settings = await getSettings(ctx.kv);
          return { settings };
        },
      },
      "settings/save": {
        handler: async (ctx: RouteContext) => {
          const { settings } = ctx.input as { settings: Record<string, string> };
          for (const [key, value] of Object.entries(settings)) {
            await ctx.kv.set(`settings:${key}`, value);
          }
          return { ok: true };
        },
      },
      "test": {
        handler: async (ctx: RouteContext) => {
          const settings = await getSettings(ctx.kv);
          const { apiToken, fromAddress } = settings;

          if (!apiToken || !fromAddress) {
            return { ok: false, error: "Please configure your API token and from address first." };
          }

          try {
            const client = new Lettermint({ apiToken });
            await client.email
              .from(fromAddress)
              .to(fromAddress)
              .subject("Lettermint test email from EmDash")
              .text("If you're reading this, your Lettermint email integration is working!")
              .send();

            return { ok: true };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { ok: false, error: `Lettermint error: ${message}` };
          }
        },
      },
    },

    admin: {
      settingsSchema: {
        apiToken: {
          type: "secret" as const,
          label: "API token",
          description: "Your Lettermint API token (from dash.lettermint.co)",
        },
        fromAddress: {
          type: "string" as const,
          label: "From address",
          description: "Default sender address (e.g. You <you@yourdomain.com>)",
        },
      },
      pages: [
        { path: "/settings", label: "Lettermint", icon: "settings" },
      ],
    },
  });
}

export default createPlugin;
