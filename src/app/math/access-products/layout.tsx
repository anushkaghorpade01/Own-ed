"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const subNav = [
  { href: "/math/access-products", label: "Overview" },
  { href: "/math/access-products/flexible", label: "Flexible Credits" },
  { href: "/math/access-products/pack-designer", label: "Pack Designer" },
  { href: "/math/access-products/standing", label: "Standing Spots" },
  { href: "/math/access-products/standby", label: "Standby" },
  { href: "/math/access-products/mix", label: "Product Mix" },
  { href: "/math/access-products/credit-health", label: "Credit Health" },
  { href: "/math/access-products/actuals", label: "Actuals" },
];

export default function AccessProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-[#E8E2D9] pb-3">
        {subNav.map((item) => {
          const active =
            item.href === "/math/access-products"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-[#2C2825] text-white"
                  : "text-[#6B6560] hover:bg-[#F0EBE3] hover:text-[#2C2825]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
