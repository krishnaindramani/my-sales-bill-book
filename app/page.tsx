import { redirect } from "next/navigation";

export default function RootPage() {
  // Automatically routes anyone who visits the home link straight to your invoices screen
  redirect("/invoices");
}