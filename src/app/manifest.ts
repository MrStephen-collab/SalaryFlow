import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalaryFlow",
    short_name: "SalaryFlow",
    description:
      "Manage employee loans, salary deductions, repayments and financial accounts from one simple platform.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#071A2F",
    theme_color: "#102A43",
    icons: [
      {
        src: "/brand/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/brand/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
