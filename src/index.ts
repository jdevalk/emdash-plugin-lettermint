import type { PluginDescriptor } from "emdash";

export function lettermintPlugin(): PluginDescriptor {
  return {
    id: "lettermint",
    version: "0.4.0",
    format: "standard",
    capabilities: ["email:provide", "network:fetch"],
    allowedHosts: ["api.lettermint.co"],
    entrypoint: "@jdevalk/emdash-plugin-lettermint/sandbox",
    options: {},
    adminPages: [{ path: "/settings", label: "Lettermint", icon: "email" }],
  };
}

export default lettermintPlugin;
