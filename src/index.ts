import { definePlugin } from "emdash";
import type { PluginContext, PluginDescriptor, RouteContext } from "emdash";

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
 * Delivers an email via the Lettermint API.
 */
async function deliverHandler(event: EmailDeliverEvent, ctx: PluginContext) {
  const entries = await ctx.kv.list("settings:");
  const settings = new Map<string, string>();
  for (const { key, value } of entries) {
    if (typeof value === "string") {
      settings.set(key.replace("settings:", ""), value);
    }
  }

  const apiToken = settings.get("apiToken");
  const fromAddress = settings.get("fromAddress");

  if (!apiToken) {
    ctx.log.error("Lettermint API token not configured");
    return;
  }

  if (!fromAddress) {
    ctx.log.error("Lettermint from address not configured");
    return;
  }

  const body: Record<string, string> = {
    from: fromAddress,
    to: event.message.to,
    subject: event.message.subject,
    text: event.message.text,
  };

  if (event.message.html) {
    body.html = event.message.html;
  }

  const response = await ctx.http?.fetch("https://api.lettermint.co/v1/email/send", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response || !response.ok) {
    ctx.log.error(`Lettermint delivery failed: ${response?.status ?? "no response"}`);
    return;
  }

  const result = await response.json();
  ctx.log.info(`Email delivered via Lettermint: ${result.message_id}`);
}

export function lettermintPlugin(): PluginDescriptor {
  return {
    id: "lettermint",
    version: "0.1.0",
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
    version: "0.1.0",
    capabilities: ["email:provide", "network:fetch"],
    allowedHosts: ["api.lettermint.co"],

    hooks: {
      "email:deliver": {
        exclusive: true,
        handler: deliverHandler,
      },
    },

    routes: {
      "settings": {
        handler: async (ctx: RouteContext) => {
          const entries = await ctx.kv.list("settings:");
          const settings: Record<string, string> = {};
          for (const { key, value } of entries) {
            const k = key.replace("settings:", "");
            settings[k] = typeof value === "string" ? value : String(value);
          }
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
