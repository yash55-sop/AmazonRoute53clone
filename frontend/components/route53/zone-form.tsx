"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Popover from "@cloudscape-design/components/popover";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import { zonesApi } from "@/lib/api/route53";
import type { ZoneType } from "@/types/api";
import { useNotifications } from "@/components/shell/notifications";

const DESCRIPTION_LIMIT = 256;
const DOMAIN_PATTERN =
  /^(?=.{1,253}\.?$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.?$/i;
const VALID_CHARACTERS =
  "Valid characters: a-z, 0-9, ! \" # $ % & ' ( ) * + , - / : ; < = > ? @ [ \\ ] ^ _ ` { | } ~ .";

const regionOptions: SelectProps.Options = [
  { label: "US East (N. Virginia)", value: "us-east-1" },
  { label: "US West (Oregon)", value: "us-west-2" },
  { label: "Europe (Ireland)", value: "eu-west-1" },
];

const vpcOptions: SelectProps.Options = [
  { label: "vpc-0123456789abcdef0", value: "vpc-0123456789abcdef0" },
  { label: "vpc-0abcdef1234567890", value: "vpc-0abcdef1234567890" },
  { label: "vpc-00112233445566778", value: "vpc-00112233445566778" },
];

function InfoPopover({
  header,
  children,
}: {
  header: string;
  children: string;
}) {
  return (
    <Popover
      dismissButton
      dismissAriaLabel="Close"
      header={header}
      content={children}
      position="right"
      size="medium"
      triggerType="text"
    >
      Info
    </Popover>
  );
}

export function ZoneForm() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [zoneType, setZoneType] = useState<ZoneType>("PUBLIC");
  const [region, setRegion] = useState<SelectProps.Option>(regionOptions[0]);
  const [vpc, setVpc] = useState<SelectProps.Option>(vpcOptions[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;

    const domainName = name.trim();
    if (!domainName) {
      setNameError("Enter a domain name.");
      return;
    }
    if (!DOMAIN_PATTERN.test(domainName)) {
      setNameError(
        "Enter a valid fully qualified domain name, such as example.com.",
      );
      return;
    }

    setSubmitting(true);
    setError("");
    setNameError("");
    try {
      const zone = await zonesApi.create({
        name: domainName,
        description: description.trim(),
        zone_type: zoneType,
      });
      notify(
        "success",
        `Hosted zone ${zone.name} was successfully created.`,
        zone.zone_type === "PRIVATE"
          ? "The selected VPC association is mocked for this educational clone."
          : undefined,
      );
      router.push(`/route53/hosted-zones/${zone.zone_id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Hosted zone couldn't be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="route53-form-page">
      <SpaceBetween size="m">
        <BreadcrumbGroup
          items={[
            { text: "Route 53", href: "/route53/dashboard" },
            { text: "Hosted zones", href: "/route53/hosted-zones" },
            { text: "Create hosted zone", href: "#" },
          ]}
          onFollow={(event) => {
            if (event.detail.href !== "#") {
              event.preventDefault();
              router.push(event.detail.href);
            }
          }}
        />

        <form onSubmit={submit}>
          <Form
            header={<Header variant="h1">Create hosted zone</Header>}
            errorText={error}
            errorIconAriaLabel="Error"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  formAction="none"
                  disabled={submitting}
                  onClick={() => router.push("/route53/hosted-zones")}
                >
                  Cancel
                </Button>
                <Button
                  formAction="submit"
                  variant="primary"
                  loading={submitting}
                  disabled={submitting}
                >
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="m">
              <Container
                header={
                  <Header
                    variant="h2"
                    description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
                  >
                    Hosted zone configuration
                  </Header>
                }
              >
                <SpaceBetween size="l">
                  <FormField
                    label="Domain name"
                    info={
                      <InfoPopover header="Domain name">
                        This identifies the domain or subdomain for the hosted
                        zone, such as example.com or dev.example.com.
                      </InfoPopover>
                    }
                    description="This is the name of the domain that you want to route traffic for."
                    constraintText={VALID_CHARACTERS}
                    errorText={nameError}
                  >
                    <Input
                      value={name}
                      onChange={({ detail }) => {
                        setName(detail.value);
                        if (nameError) setNameError("");
                      }}
                      placeholder="example.com"
                      disabled={submitting}
                      ariaRequired
                    />
                  </FormField>

                  <FormField
                    label="Description - optional"
                    info={
                      <InfoPopover header="Description">
                        A description helps distinguish hosted zones that have
                        the same or similar names.
                      </InfoPopover>
                    }
                    description="This value lets you distinguish hosted zones that have the same name."
                    constraintText={`The description can have up to ${DESCRIPTION_LIMIT} characters.`}
                    characterCountText={`${description.length}/${DESCRIPTION_LIMIT}`}
                  >
                    <Textarea
                      value={description}
                      onChange={({ detail }) =>
                        setDescription(detail.value.slice(0, DESCRIPTION_LIMIT))
                      }
                      placeholder="The hosted zone is used for..."
                      rows={4}
                      disabled={submitting}
                    />
                  </FormField>

                  <FormField
                    label="Type"
                    info={
                      <InfoPopover header="Hosted zone type">
                        Public hosted zones answer DNS queries on the internet.
                        Private hosted zones answer queries within associated
                        Amazon VPCs.
                      </InfoPopover>
                    }
                    description="The type indicates whether you want to route traffic on the internet or within one or more Amazon VPCs."
                  >
                    <Tiles
                      name="hosted-zone-type"
                      value={zoneType}
                      columns={2}
                      ariaControls="private-zone-vpc-settings"
                      onChange={({ detail }) =>
                        setZoneType(detail.value as ZoneType)
                      }
                      items={[
                        {
                          value: "PUBLIC",
                          label: "Public hosted zone",
                          description:
                            "A public hosted zone determines how Route 53 responds to DNS queries on the internet.",
                        },
                        {
                          value: "PRIVATE",
                          label: "Private hosted zone",
                          description:
                            "A private hosted zone determines how Route 53 responds to DNS queries within associated VPCs.",
                        },
                      ]}
                    />
                  </FormField>

                  {zoneType === "PRIVATE" ? (
                    <div id="private-zone-vpc-settings">
                      <Container
                        header={
                          <Header
                            variant="h3"
                            description="Choose the mock VPC where resources can resolve records in this private hosted zone. VPC associations are not persisted in this educational clone."
                          >
                            VPCs to associate with the hosted zone
                          </Header>
                        }
                      >
                        <ColumnLayout columns={2} variant="text-grid">
                          <FormField label="Region">
                            <Select
                              selectedOption={region}
                              options={regionOptions}
                              selectedAriaLabel="Selected"
                              onChange={({ detail }) =>
                                setRegion(detail.selectedOption)
                              }
                              disabled={submitting}
                            />
                          </FormField>
                          <FormField label="VPC ID">
                            <Select
                              selectedOption={vpc}
                              options={vpcOptions}
                              selectedAriaLabel="Selected"
                              onChange={({ detail }) =>
                                setVpc(detail.selectedOption)
                              }
                              disabled={submitting}
                            />
                          </FormField>
                        </ColumnLayout>
                      </Container>
                    </div>
                  ) : null}
                </SpaceBetween>
              </Container>

              <ExpandableSection
                variant="container"
                headerText="Tags - optional"
                headerDescription="Tags help identify and organize AWS resources."
              >
                <Box color="text-body-secondary">
                  Tags are intentionally mocked and are not persisted in this
                  educational clone.
                </Box>
              </ExpandableSection>
            </SpaceBetween>
          </Form>
        </form>
      </SpaceBetween>
    </div>
  );
}
