"use client";

import { SectionHeader, SampleBanner } from "@/components/shared/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActualsPage() {
  return (
    <div>
      <SectionHeader
        title="Actuals"
        description="Track monthly actual performance once the studio launches. Compare budget vs actual vs variance."
      />
      <SampleBanner />

      <Card>
        <CardHeader>
          <CardTitle>Post-launch tracking</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[#6B6560]">
          <p>Once OWN opens, enter monthly actuals here:</p>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li>Available seats, bookings, attendance</li>
            <li>Waitlists and failed bookings</li>
            <li>Credits sold, used, expired</li>
            <li>Actual revenue and expenses</li>
            <li>Cash position and new customers</li>
          </ul>
          <p className="mt-4 text-xs text-[#A39E98]">
            Historical forecasts are never overwritten — actuals are stored separately for variance analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
