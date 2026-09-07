"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { recordsApi, zonesApi } from "@/lib/api/route53";
import type { HostedZone, RecordType } from "@/types/api";
import { useNotifications } from "@/components/shell/notifications";

const types = [
  "A",
  "AAAA",
  "CNAME",
  "TXT",
  "MX",
  "NS",
  "PTR",
  "SRV",
  "CAA",
].map((value) => ({ label: value, value }));
const help: Record<RecordType, string> = {
  A: "Enter an IPv4 address, such as 192.0.2.1.",
  AAAA: "Enter an IPv6 address, such as 2001:db8::1.",
  CNAME: "Enter the fully qualified destination hostname.",
  TXT: "Enter the text value exactly as it should be published.",
  MX: "Enter a priority and mail server, such as 10 mail.example.com.",
  NS: "Enter the authoritative name server hostname.",
  PTR: "Enter the hostname used for reverse DNS.",
  SRV: "Enter priority, weight, port, and target.",
  CAA: "Enter flags, tag, and quoted value.",
  SOA: "SOA records are managed automatically.",
};

export function RecordForm({ mode }: { mode: "create" | "edit" }) {
  const { zoneId, recordId } = useParams<{
    zoneId: string;
    recordId?: string;
  }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<RecordType>("A");
  const [value, setValue] = useState("");
  const [ttl, setTtl] = useState("300");
  const [alias, setAlias] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(mode === "edit");
  useEffect(() => {
    let active = true;
    Promise.all([
      zonesApi.get(zoneId),
      mode === "edit" && recordId
        ? recordsApi.get(zoneId, recordId)
        : Promise.resolve(null),
    ])
      .then(([zoneResult, record]) => {
        if (!active) return;
        setZone(zoneResult);
        if (record) {
          setName(
            record.name === zoneResult.name
              ? ""
              : record.name.slice(0, -`.${zoneResult.name}`.length),
          );
          setType(record.type);
          setValue(record.value);
          setTtl(String(record.ttl));
          setAlias(record.is_alias);
        }
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Record could not be loaded.",
        ),
      )
      .finally(() => setLoading(false));
    return () => {
      active = false;
    };
  }, [mode, recordId, zoneId]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const ttlNumber = Number(ttl);
    if (!Number.isInteger(ttlNumber) || ttlNumber <= 0) {
      setError("TTL must be a positive whole number.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const input = {
        name: name || "@",
        type,
        value,
        ttl: ttlNumber,
        routing_policy: "SIMPLE" as const,
        is_alias: alias,
      };
      if (mode === "edit" && recordId)
        await recordsApi.update(zoneId, recordId, input);
      else await recordsApi.create(zoneId, input);
      const recordName = name ? `${name}.${zone?.name}` : zone?.name;
      notify(
        "success",
        mode === "edit"
          ? `Record ${recordName} was updated.`
          : `Record ${recordName} was created.`,
        `${type} record is ready.`,
      );
      router.push(`/route53/hosted-zones/${zoneId}`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save the record.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  if (loading) return <div>Loading record…</div>;
  return (
    <SpaceBetween size="m">
      <BreadcrumbGroup
        items={[
          { text: "Route 53", href: "/route53/dashboard" },
          { text: "Hosted zones", href: "/route53/hosted-zones" },
          {
            text: zone?.name ?? zoneId,
            href: `/route53/hosted-zones/${zoneId}`,
          },
          {
            text: mode === "edit" ? "Edit record" : "Create record",
            href: "#",
          },
        ]}
        onFollow={(e) => {
          if (e.detail.href !== "#") {
            e.preventDefault();
            router.push(e.detail.href);
          }
        }}
      />
      <form onSubmit={submit}>
        <Form
          header={
            <Header variant="h1">
              {mode === "edit" ? "Edit record" : "Create record"}
            </Header>
          }
          errorText={error}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                formAction="none"
                onClick={() => router.push(`/route53/hosted-zones/${zoneId}`)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                formAction="submit"
                loading={submitting}
                disabled={!value.trim()}
              >
                Save record
              </Button>
            </SpaceBetween>
          }
        >
          <Container
            header={
              <Header
                variant="h2"
                description="Configure how DNS queries for this name are answered."
              >
                Record configuration
              </Header>
            }
          >
            <SpaceBetween size="l">
              <div className="record-grid">
                <FormField
                  label="Record name"
                  description={`Leave blank to create a record for ${zone?.name ?? "the root domain"}.`}
                >
                  <Input
                    value={name}
                    onChange={({ detail }) => setName(detail.value)}
                    placeholder="subdomain"
                  />
                </FormField>
                <FormField label="Record type" description={help[type]}>
                  <Select
                    selectedOption={
                      types.find((item) => item.value === type) ?? types[0]
                    }
                    options={types}
                    onChange={({ detail }) =>
                      setType(detail.selectedOption.value as RecordType)
                    }
                  />
                </FormField>
              </div>
              <Toggle
                checked={alias}
                onChange={({ detail }) => setAlias(detail.checked)}
              >
                Alias
              </Toggle>
              <FormField label="Value" description={help[type]}>
                <Textarea
                  value={value}
                  onChange={({ detail }) => setValue(detail.value)}
                  rows={5}
                />
              </FormField>
              <div className="record-grid">
                <FormField
                  label="TTL (seconds)"
                  description="Recommended range: 60 to 172800"
                >
                  <Input
                    value={ttl}
                    inputMode="numeric"
                    onChange={({ detail }) => setTtl(detail.value)}
                  />
                </FormField>
                <FormField label="Routing policy">
                  <Select
                    selectedOption={{
                      label: "Simple routing",
                      value: "SIMPLE",
                    }}
                    options={[{ label: "Simple routing", value: "SIMPLE" }]}
                    onChange={() => undefined}
                    disabled
                  />
                </FormField>
              </div>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
    </SpaceBetween>
  );
}
