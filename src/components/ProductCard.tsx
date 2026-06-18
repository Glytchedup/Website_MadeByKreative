import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { StockBadge } from "./StockBadge";

interface Props {
  product: {
    slug: string;
    title: string;
    images: string[];
    minPrice: number;
    totalStock: number;
    variants: { length: number };
    collection?: { name: string } | null;
  };
}

export function ProductCard({ product }: Props) {
  const img = product.images[0];
  const multi = product.variants.length > 1;
  return (
    <Link
      href={`/products/${product.slug}`}
      className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-square overflow-hidden bg-linen">
        {img ? (
          <Image
            src={img}
            alt={product.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">No image</div>
        )}
        <div className="absolute left-2 top-2">
          <StockBadge quantity={product.totalStock} />
        </div>
      </div>
      <div className="p-3">
        {product.collection && (
          <p className="text-xs uppercase tracking-wide text-muted">{product.collection.name}</p>
        )}
        <h3 className="mt-0.5 line-clamp-2 text-sm font-semibold">{product.title}</h3>
        <p className="mt-1 text-sm font-bold text-terracotta">
          {multi ? "from " : ""}
          {formatPrice(product.minPrice)}
        </p>
      </div>
    </Link>
  );
}
