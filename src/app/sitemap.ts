import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const staticRoutes = ["", "/shop", "/collections", "/about", "/policies", "/contact"].map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const [products, collections] = await Promise.all([
    prisma.product.findMany({ where: { status: "active" }, select: { slug: true, updatedAt: true } }).catch(() => []),
    prisma.collection.findMany({ select: { slug: true, updatedAt: true } }).catch(() => []),
  ]);

  return [
    ...staticRoutes,
    ...collections.map((c) => ({ url: `${base}/collections/${c.slug}`, lastModified: c.updatedAt, priority: 0.6 })),
    ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt, priority: 0.8 })),
  ];
}
