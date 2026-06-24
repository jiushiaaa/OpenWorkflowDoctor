/** @type {import("next").NextConfig} */
const nextConfig = {
  devIndicators: false,
  transpilePackages: ["@openworkflowdoctor/workflow-ai", "@openworkflowdoctor/workflow-ir"]
};

export default nextConfig;
