"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import TopNavigation from "@cloudscape-design/components/top-navigation";
import { AuthError } from "@/lib/api/auth";
import { useAuth } from "@/components/auth/auth-provider";

export default function LoginPage() {
  const { loading, signIn, user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState("demo");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/route53/hosted-zones");
  }, [loading, router, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn({ username, password });
      router.replace("/route53/hosted-zones");
    } catch (reason) {
      setError(
        reason instanceof AuthError
          ? reason.message
          : "Sign-in failed. Try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user)
    return <main className="auth-loading">Checking your session…</main>;

  return (
    <>
      <TopNavigation
        identity={{
          href: "/login",
          title: "AWS",
          logo: { src: "/aws-mark.svg", alt: "AWS" },
        }}
        utilities={[
          {
            type: "button",
            text: "Route 53 clone",
            ariaLabel: "Route 53 educational clone",
          },
        ]}
      />
      <main className="login-page">
        <section className="login-card" aria-label="Sign in">
          <Container>
            <form onSubmit={handleSubmit}>
              <Form
                header={
                  <Header
                    variant="h1"
                    description="Use the demo account to explore the Route 53 console."
                  >
                    Sign in as IAM user
                  </Header>
                }
                errorText={error || undefined}
                errorIconAriaLabel="Error"
                actions={
                  <Button
                    variant="primary"
                    formAction="submit"
                    loading={submitting}
                    disabled={!account || !username || !password}
                  >
                    Sign in
                  </Button>
                }
              >
                <SpaceBetween size="l">
                  <FormField label="Account ID or alias">
                    <Input
                      value={account}
                      onChange={({ detail }) => setAccount(detail.value)}
                      autoComplete="organization"
                    />
                  </FormField>
                  <FormField label="IAM user name">
                    <Input
                      value={username}
                      onChange={({ detail }) => setUsername(detail.value)}
                      autoComplete="username"
                    />
                  </FormField>
                  <FormField label="Password">
                    <Input
                      value={password}
                      onChange={({ detail }) => setPassword(detail.value)}
                      type="password"
                      autoComplete="current-password"
                    />
                  </FormField>
                </SpaceBetween>
              </Form>
            </form>
            <Box
              margin={{ top: "l" }}
              textAlign="center"
              color="text-body-secondary"
            >
              Demo credentials: admin / admin123
            </Box>
          </Container>
        </section>
      </main>
    </>
  );
}
