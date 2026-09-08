export default {
  transpilePackages: [
    "@messmate/api-client",
    "@messmate/types",
    "@messmate/shared",
    "@messmate/validation",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
};
