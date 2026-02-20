/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/", destination: "/legions.html" },
      { source: "/work", destination: "/work.html" },
      { source: "/arts", destination: "/arts.html" },
      { source: "/skills", destination: "/skills.html" },
      { source: "/blogs", destination: "/blogs.html" },
      { source: "/blog/:slug*", destination: "/blog/:slug*.html" }
    ];
  }
};

export default nextConfig;
