import { definePlugin, type PluginContext } from "emdash";

const EMAIL_RE = /^.+@.+\..+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

interface EmailDeliverEvent {
  message: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  };
  source: string;
}

async function sendViaLettermint(
  ctx: PluginContext,
  apiToken: string,
  payload: { from: string; to: string[]; subject: string; text?: string; html?: string },
) {
  if (!ctx.http) {
    throw new Error("Missing network:fetch capability");
  }

  const response = await ctx.http.fetch("https://api.lettermint.co/v1/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "x-lettermint-token": apiToken,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lettermint API returned ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<{ message_id: string; status: string }>;
}

async function buildSettingsPage(ctx: PluginContext) {
  const hasToken = !!(await ctx.kv.get<string>("settings:apiToken"));
  const fromAddress = (await ctx.kv.get<string>("settings:fromAddress")) ?? "";

  return {
    blocks: [
      {
        type: "section",
        text: "Configure your Lettermint API credentials to enable outbound emails.",
      },
      {
        type: "form",
        submit: { label: "Save Settings", action_id: "save_settings" },
        fields: [
          {
            type: "secret_input",
            action_id: "apiToken",
            label: "API Token",
            placeholder: "Enter your Lettermint API token",
            has_value: hasToken,
            required: true,
          },
          {
            type: "text_input",
            action_id: "fromAddress",
            label: "From Address",
            placeholder: "You <you@yourdomain.com>",
            initial_value: fromAddress,
            required: true,
          },
        ],
      },
      {
        type: "section",
        text: "Send a test email to verify your credentials.",
      },
      {
        type: "form",
        submit: { label: "Send Test Email", action_id: "test_email" },
        fields: [
          {
            type: "text_input",
            action_id: "testEmailAddress",
            label: "Test Email Recipient",
            placeholder: "you@example.com",
            initial_value: "",
          },
        ],
      },
    ],
  };
}

async function saveSettings(ctx: PluginContext, values: Record<string, unknown>) {
  try {
    if (typeof values.apiToken === "string" && values.apiToken && values.apiToken !== "********") {
      await ctx.kv.set("settings:apiToken", values.apiToken);
    }

    if (typeof values.fromAddress === "string") {
      if (!isValidEmail(values.fromAddress)) {
        return {
          ...(await buildSettingsPage(ctx)),
          toast: { message: "Invalid From Address (must be a valid email)", type: "error" },
        };
      }
      await ctx.kv.set("settings:fromAddress", values.fromAddress);
    }

    return {
      ...(await buildSettingsPage(ctx)),
      toast: { message: "Settings saved successfully", type: "success" },
    };
  } catch (error) {
    ctx.log.error("Failed to save Lettermint settings", error);
    return {
      ...(await buildSettingsPage(ctx)),
      toast: { message: "Failed to save settings", type: "error" },
    };
  }
}

export default definePlugin({
  hooks: {
    "email:deliver": {
      exclusive: true,
      handler: async (event: EmailDeliverEvent, ctx: PluginContext) => {
        const apiToken = await ctx.kv.get<string>("settings:apiToken");
        const fromAddress = await ctx.kv.get<string>("settings:fromAddress");

        if (!apiToken || !fromAddress) {
          ctx.log.error("Cannot send email: Lettermint API token or From Address is missing");
          throw new Error("Lettermint credentials missing. Configure them in plugin settings.");
        }

        const { message } = event;
        const result = await sendViaLettermint(ctx, apiToken, {
          from: fromAddress,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          ...(message.html && { html: message.html }),
        });

        ctx.log.info("Email delivered via Lettermint", { messageId: result.message_id });
      },
    },
  },

  routes: {
    admin: {
      handler: async (routeCtx: { input: unknown; request: { url: string } }, ctx: PluginContext) => {
        const interaction = routeCtx.input as {
          type: string;
          page?: string;
          action_id?: string;
          values?: Record<string, unknown>;
        };

        if (interaction.type === "page_load" && interaction.page === "/settings") {
          return buildSettingsPage(ctx);
        }

        if (interaction.type === "form_submit" && interaction.action_id === "save_settings") {
          return saveSettings(ctx, interaction.values ?? {});
        }

        if (interaction.type === "form_submit" && interaction.action_id === "test_email") {
          try {
            const apiToken = await ctx.kv.get<string>("settings:apiToken");
            const fromAddress = await ctx.kv.get<string>("settings:fromAddress");
            const testEmailAddress = interaction.values?.testEmailAddress as string;

            if (!apiToken || !fromAddress) {
              return {
                ...(await buildSettingsPage(ctx)),
                toast: { message: "Configure API Token and From Address before sending a test", type: "error" },
              };
            }

            if (!testEmailAddress || !isValidEmail(testEmailAddress)) {
              return {
                ...(await buildSettingsPage(ctx)),
                toast: { message: "Enter a valid test email address", type: "error" },
              };
            }

            const result = await sendViaLettermint(ctx, apiToken, {
              from: fromAddress,
              to: [testEmailAddress],
              subject: "Lettermint test email from EmDash",
              text: "Hello from your EmDash Lettermint plugin! If you see this, your API credentials are correct.",
            });

            return {
              ...(await buildSettingsPage(ctx)),
              toast: { message: `Test email sent! (${result.message_id})`, type: "success" },
            };
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            return {
              ...(await buildSettingsPage(ctx)),
              toast: { message: `Error: ${message}`, type: "error" },
            };
          }
        }

        return { blocks: [] };
      },
    },
  },
});
