import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

export default (phase) => {
  const development = phase === PHASE_DEVELOPMENT_SERVER;
  if (
    !development &&
    process.env.NEXT_PUBLIC_API_BASE_URL &&
    process.env.NEXT_PUBLIC_API_BASE_URL !== "/api"
  )
    throw new Error(
      "Production NEXT_PUBLIC_API_BASE_URL must be /api for secure same-origin sessions.",
    );
  return {
    transpilePackages: [
      "@messmate/api-client",
      "@messmate/types",
      "@messmate/shared",
      "@messmate/validation",
      "@messmate/api",
      "@messmate/database",
    ],
    serverExternalPackages: ["pg", "@electric-sql/pglite"],
    async rewrites() {
      if (!development) return [];
      return {
        beforeFiles: [
          {
            source: "/api/:path*",
            destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/:path*`,
          },
        ],
      };
    },
    allowedDevOrigins: ["127.0.0.1"],
    poweredByHeader: false,
  };
};
