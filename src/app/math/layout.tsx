import { MathNav } from "@/components/layout/math-nav";
import { SampleStatusChip } from "@/components/shared/metric-card";

export default function MathLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
      <MathNav />
      <div className="min-w-0 flex-1">
        <div className="mb-3 lg:hidden">
          <MathNav compact />
        </div>
        <div className="mb-4">
          <SampleStatusChip />
        </div>
        {children}
      </div>
    </div>
  );
}
