import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/route53/hosted-zones");
}
