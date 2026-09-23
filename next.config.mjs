/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.module.rules.push({
      test: /Curves_black\.svg$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
