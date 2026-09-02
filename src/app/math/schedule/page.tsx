import { redirect } from "next/navigation";

/** Schedule editing lives on Capacity for now — weekly timetable is optional advanced input. */
export default function ScheduleRedirectPage() {
  redirect("/math/capacity");
}
