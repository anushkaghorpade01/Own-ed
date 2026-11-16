import { redirect } from "next/navigation";

/** The operating plan is part of Capacity and Assumptions, not a duplicate page. */
export default function Page() { redirect("/math/capacity"); }
