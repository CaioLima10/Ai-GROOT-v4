import type { NextConfig } from "next";

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
    const defaultBackendTarget = `http://localhost:${process.env.API_PORT || process.env.PORT || "3001"}`;
    const backendTarget = (process.env.NEXT_PUBLIC_BACKEND_PROXY_TARGET || defaultBackendTarget).replace(/\/$/, "");
    return [
      {
        source: "/backend/:path*",
        destination: `${backendTarget}/:path*`
      }
    ];
  }
};

export default nextConfig;
