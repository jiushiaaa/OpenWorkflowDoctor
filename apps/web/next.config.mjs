/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@openworkflowdoctor/workflow-ai", "@openworkflowdoctor/workflow-ir"],
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".js"]
    };
    return config;
  }
};

export default nextConfig;
