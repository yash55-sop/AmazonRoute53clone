"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "@cloudscape-design/components/app-layout";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import RadioGroup from "@cloudscape-design/components/radio-group";
import SideNavigation from "@cloudscape-design/components/side-navigation";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  type ThemePreference,
  useTheme,
} from "@/components/theme/theme-provider";
import { NotificationProvider } from "./notifications";

const navigationItems = [
  { type: "link" as const, text: "Dashboard", href: "/route53/dashboard" },
  {
    type: "link" as const,
    text: "Hosted zones",
    href: "/route53/hosted-zones",
  },
  {
    type: "link" as const,
    text: "Health checks",
    href: "/route53/health-checks",
  },
  { type: "divider" as const },
  {
    type: "section" as const,
    text: "Traffic flow",
    items: [
      {
        type: "link" as const,
        text: "Traffic policies",
        href: "/route53/traffic-policies",
      },
    ],
  },
  {
    type: "section" as const,
    text: "Resolver",
    items: [
      { type: "link" as const, text: "Resolver", href: "/route53/resolver" },
    ],
  },
  {
    type: "section" as const,
    text: "Profiles",
    items: [
      { type: "link" as const, text: "Profiles", href: "/route53/profiles" },
    ],
  },
];

export function Route53Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { preference, setPreference } = useTheme();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [globalSearch, setGlobalSearch] = useState("");
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  return (
    <>
      <NotificationProvider>
        <TopNavigation
          identity={{
            href: "/route53/hosted-zones",
            title: "AWS",
            logo: { src: "/aws-mark.svg", alt: "AWS" },
          }}
          search={
            <Input
              type="search"
              value={globalSearch}
              onChange={({ detail }) => setGlobalSearch(detail.value)}
              placeholder="Search services and resources"
              ariaLabel="Search"
            />
          }
          utilities={[
            {
              type: "button",
              text: "Global",
              iconName: "globe",
              ariaLabel: "Region: Global",
            },
            {
              type: "menu-dropdown",
              text: user?.username ?? "Account",
              description: "Demo account",
              iconName: "user-profile",
              items: [
                { id: "appearance", text: "Appearance" },
                { id: "logout", text: "Sign out" },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === "appearance") setAppearanceOpen(true);
                if (detail.id === "logout") void signOut();
              },
            },
          ]}
        />
        <AppLayout
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
          navigation={
            <SideNavigation
              header={{ href: "/route53/hosted-zones", text: "Route 53" }}
              activeHref={pathname}
              items={navigationItems}
              onFollow={(event) => {
                if (!event.detail.external) {
                  event.preventDefault();
                  router.push(event.detail.href);
                }
              }}
            />
          }
          toolsHide
          contentType="table"
          content={children}
        />
        <Modal
          visible={appearanceOpen}
          onDismiss={() => setAppearanceOpen(false)}
          closeAriaLabel="Close appearance settings"
          header="Appearance"
          footer={
            <Box float="right">
              <Button
                variant="primary"
                onClick={() => setAppearanceOpen(false)}
              >
                Done
              </Button>
            </Box>
          }
        >
          <FormField label="Color mode">
            <RadioGroup
              name="route53-theme"
              value={preference}
              onChange={({ detail }) =>
                setPreference(detail.value as ThemePreference)
              }
              items={[
                {
                  value: "light",
                  label: "Light",
                  description: "Always use the light color mode.",
                },
                {
                  value: "dark",
                  label: "Dark",
                  description: "Always use the dark color mode.",
                },
                {
                  value: "system",
                  label: "System",
                  description: "Match your operating system setting.",
                },
              ]}
            />
          </FormField>
        </Modal>
      </NotificationProvider>
    </>
  );
}
