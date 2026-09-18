import { redirect } from "next/navigation";

/** There is no Home view — `/` lands on the first section in the nav. */
export default function RootPage() {
  redirect("/tools");
}
