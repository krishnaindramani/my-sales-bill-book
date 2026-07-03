import { redirect } from "next/navigation";

export default function RootPage() {
  // Automatically routes visitors straight to your active invoices panel
  redirect("/dashboard");
}