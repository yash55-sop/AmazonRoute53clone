"use client";

import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";

export function ComingSoon({ title }: { title: string }) {
  const router = useRouter();
  return (
    <SpaceBetween size="m">
      <BreadcrumbGroup
        items={[
          { text: "Route 53", href: "/route53/dashboard" },
          { text: title, href: "#" },
        ]}
        onFollow={(e) => {
          if (e.detail.href !== "#") {
            e.preventDefault();
            router.push(e.detail.href);
          }
        }}
      />
      <Header variant="h1">{title}</Header>
      <Container>
        <Box textAlign="center" padding={{ vertical: "xxl" }}>
          <SpaceBetween size="m">
            <Box variant="h2">Coming soon</Box>
            <Box variant="p" color="text-body-secondary">
              This Route 53 workflow is represented in navigation and will be
              added in a future release.
            </Box>
            <Button onClick={() => router.push("/route53/hosted-zones")}>
              Go to hosted zones
            </Button>
          </SpaceBetween>
        </Box>
      </Container>
    </SpaceBetween>
  );
}
