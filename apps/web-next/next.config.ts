import type { NextConfig } from "next";
import { resolveGiomBackendProxyTarget } from "../../config/runtimePorts.js";

const nextConfig: NextConfig = {
  // Força o agente HTTP interno do Next.js a reutilizar conexões TCP com o backend.
  // Sem isso, cada requisição de proxy abre uma nova conexão e paga custo de handshake.
  httpAgentOptions: {
    keepAlive: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.thesportsdb.com"
      },
      {
        protocol: "https",
        hostname: "r2.thesportsdb.com"
      },
      {
        protocol: "https",
        hostname: "crests.football-data.org"
      }
    ]
  },
  async rewrites() {
    const backendTarget = resolveGiomBackendProxyTarget(process.env);
    return [
      {
        source: "/backend/:path*",
        destination: `${backendTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
