import { apiFetch as baseFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

const API = "/_emdash/api/plugins/lettermint";

async function apiFetch(route: string, body?: unknown): Promise<Response> {
  return baseFetch(`${API}/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

interface FieldDef {
  key: string;
  type: "string" | "secret";
  label: string;
  description?: string;
}

const FIELDS: FieldDef[] = [
  { key: "apiToken", type: "secret", label: "API token", description: "Your Lettermint API token (from dash.lettermint.co)" },
  { key: "fromAddress", type: "string", label: "From address", description: "Default sender address (e.g. You <you@yourdomain.com>)" },
];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.75rem", borderRadius: 6,
  border: "1px solid #d1d5db", fontSize: "0.875rem",
  fontFamily: "inherit",
};

function Field({ field, value, onChange }: { field: FieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label style={{ display: "block", fontWeight: 500, marginBottom: 4, fontSize: "0.875rem" }}>
        {field.label}
      </label>
      {field.description && (
        <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: 4 }}>{field.description}</div>
      )}
      <input
        type={field.type === "secret" ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function SettingsPage() {
  const [settings, setSettings] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);

  React.useEffect(() => {
    apiFetch("settings").then(async (res) => {
      const data = await parseApiResponse<{ settings: Record<string, string> }>(res);
      setSettings(data.settings || {});
      setLoading(false);
    }).catch((err) => {
      setError(String(err));
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await apiFetch("settings/save", { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("test");
      const data = await parseApiResponse<{ ok: boolean; error?: string }>(res);
      if (data.ok) {
        setTestResult({ ok: true, message: "Test email sent! Check your inbox." });
      } else {
        setTestResult({ ok: false, message: data.error || "Failed to send test email." });
      }
    } catch (err) {
      setTestResult({ ok: false, message: String(err) });
    }
    setTesting(false);
  };

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div style={{ padding: "2rem" }}>Loading settings...</div>;
  if (error) return <div style={{ padding: "2rem", color: "#dc2626" }}>Error: {error}</div>;

  return (
    <div style={{ maxWidth: 640, padding: "1.5rem 0" }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>Lettermint Settings</h2>
      {FIELDS.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={settings[field.key] || ""}
          onChange={(v) => update(field.key, v)}
        />
      ))}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "0.5rem 1.5rem", borderRadius: 6, background: "#4a1525",
          color: "white", border: "none", cursor: saving ? "wait" : "pointer", fontWeight: 500,
        }}
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>
      {saved && <span style={{ marginLeft: 12, color: "#16a34a", fontSize: "0.875rem" }}>Settings saved!</span>}

      <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #e5e7eb" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.5rem" }}>Test Connection</h3>
        <p style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.75rem" }}>
          Send a test email to your configured from address to verify your settings.
        </p>
        <button
          onClick={handleTest}
          disabled={testing}
          style={{
            padding: "0.5rem 1.5rem", borderRadius: 6, background: "#fff",
            color: "#4a1525", border: "1px solid #4a1525", cursor: testing ? "wait" : "pointer", fontWeight: 500,
          }}
        >
          {testing ? "Sending..." : "Send Test Email"}
        </button>
        {testResult && (
          <span style={{ marginLeft: 12, color: testResult.ok ? "#16a34a" : "#dc2626", fontSize: "0.875rem" }}>
            {testResult.message}
          </span>
        )}
      </div>
    </div>
  );
}

export const pages = {
  "/settings": SettingsPage,
};
