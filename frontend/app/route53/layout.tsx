import { Route53Shell } from "@/components/shell/route53-shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Route53Shell>{children}</Route53Shell>;
}
