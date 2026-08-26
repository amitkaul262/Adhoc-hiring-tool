"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="tab-nav">
      <Link href="/admin/people" data-active={pathname.startsWith("/admin/people")}>People</Link>
      <Link href="/admin/vendors" data-active={pathname.startsWith("/admin/vendors")}>Vendors</Link>
    </div>
  );
}
