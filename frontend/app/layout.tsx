import type { Metadata } from "next";
import "@cloudscape-design/global-styles/index.css";
import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

const themeInitializationScript = `
(function () {
  try {
    var preference = window.localStorage.getItem("route53-theme");
    if (preference !== "light" && preference !== "dark" && preference !== "system") {
      preference = "system";
    }
    var dark = preference === "dark" ||
      (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("awsui-dark-mode", dark);
    document.body.dataset.route53Theme = preference;
  } catch (error) {
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.body.classList.toggle("awsui-dark-mode", dark);
    document.body.dataset.route53Theme = "system";
  }
})();`;

export const metadata: Metadata = {
  title: "Route 53 Clone",
  description: "Educational Route 53 management console clone.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
