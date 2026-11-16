"use client";
import { MathNav } from "@/components/layout/math-nav";
import { usePathname } from "next/navigation";
const legacy=['/math/actuals','/math/snapshots','/math/dictionary','/math/schedule'];
export default function MathLayout({children}:{children:React.ReactNode}){
 const old=legacy.includes(usePathname());
 return <div className="flex flex-col gap-4 lg:flex-row lg:gap-8"><MathNav/><div className="min-w-0 flex-1"><div className="mb-3 lg:hidden"><MathNav compact/></div>{old&&<div className="mb-4 rounded-lg border border-[#c4a882] bg-white p-4 text-sm">Legacy workspace. This page does not use the OWN 2028 live engine. Its saved data is preserved. Use Scenario Analysis for the revised plan.</div>}{children}</div></div>;
}
