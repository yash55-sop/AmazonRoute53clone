"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { zonesApi } from "@/lib/api/route53";
import type { HostedZone } from "@/types/api";
import { useNotifications } from "@/components/shell/notifications";

const typeOptions: SelectProps.Options = [
  { label: "All types", value: "" },
  { label: "Public", value: "PUBLIC" },
  { label: "Private", value: "PRIVATE" },
];

export function HostedZonesTable() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [items, setItems] = useState<HostedZone[]>([]);
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeOption, setTypeOption] = useState<SelectProps.Option>(
    typeOptions[0],
  );
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await zonesApi.list({
        search,
        zoneType: typeOption.value,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      setItems(result.items);
      setTotal(result.total);
      setPages(Math.max(result.pages, 1));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Hosted zones could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder, typeOption.value]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function removeSelected() {
    const confirmation = selected.length === 1 ? selected[0].name : "DELETE";
    if (!selected.length || confirmName !== confirmation) return;
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        selected.map((zone) => zonesApi.delete(zone.zone_id)),
      );
      const deleted = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failed = results.length - deleted;
      notify(
        failed ? "warning" : "success",
        `${deleted} hosted zone${deleted === 1 ? "" : "s"} deleted`,
        failed
          ? `${failed} hosted zone${failed === 1 ? "" : "s"} could not be deleted.`
          : "All associated DNS records were also deleted.",
      );
      setSelected([]);
      setDeleteOpen(false);
      setConfirmName("");
      await load();
    } catch (reason) {
      notify(
        "error",
        "Could not delete hosted zone",
        reason instanceof Error ? reason.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SpaceBetween size="m">
      <BreadcrumbGroup
        key="hosted-zones-breadcrumbs"
        items={[
          { text: "Route 53", href: "/route53/dashboard" },
          { text: "Hosted zones", href: "/route53/hosted-zones" },
        ]}
        onFollow={(e) => {
          e.preventDefault();
          router.push(e.detail.href);
        }}
      />
      {error ? (
        <Box key="hosted-zones-error" color="text-status-error">
          Error: {error}{" "}
          <Button variant="link" onClick={() => void load()}>
            Try again
          </Button>
        </Box>
      ) : null}
      <Table
        key="hosted-zones-table"
        variant="container"
        stickyHeader
        stripedRows
        enableKeyboardNavigation
        selectionType="multi"
        trackBy="zone_id"
        items={items}
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        loading={loading}
        loadingText="Loading hosted zones"
        sortingColumn={{ sortingField: sortBy }}
        sortingDescending={sortOrder === "desc"}
        onSortingChange={({ detail }) => {
          setSortBy(detail.sortingColumn.sortingField ?? "name");
          setSortOrder(detail.isDescending ? "desc" : "asc");
          setPage(1);
        }}
        columnDefinitions={[
          {
            id: "name",
            header: "Hosted zone name",
            sortingField: "name",
            cell: (zone) => (
              <Link
                href={`/route53/hosted-zones/${zone.zone_id}`}
                onFollow={(e) => {
                  e.preventDefault();
                  if (e.detail.href) router.push(e.detail.href);
                }}
              >
                {zone.name}
              </Link>
            ),
          },
          {
            id: "type",
            header: "Type",
            cell: (zone) => (
              <Badge color={zone.zone_type === "PUBLIC" ? "blue" : "grey"}>
                {zone.zone_type === "PUBLIC" ? "Public" : "Private"}
              </Badge>
            ),
          },
          {
            id: "records",
            header: "Record count",
            cell: (zone) => zone.record_count,
          },
          {
            id: "description",
            header: "Description",
            cell: (zone) => zone.description || "–",
          },
          { id: "id", header: "Hosted zone ID", cell: (zone) => zone.zone_id },
        ]}
        header={
          <Header
            counter={`(${total})`}
            description="A hosted zone is a container for records that define how Route 53 routes traffic for a domain and its subdomains."
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  key="refresh"
                  iconName="refresh"
                  ariaLabel="Refresh hosted zones"
                  onClick={() => void load()}
                />
                <Button
                  key="delete"
                  disabled={selected.length === 0}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete
                </Button>
                <Button
                  key="create"
                  variant="primary"
                  onClick={() => router.push("/route53/hosted-zones/create")}
                >
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <div className="table-filters">
            <TextFilter
              filteringText={search}
              filteringPlaceholder="Find hosted zones by property or value"
              filteringAriaLabel="Filter hosted zones"
              onChange={({ detail }) => {
                setSearch(detail.filteringText);
                setPage(1);
              }}
            />
            <Select
              selectedOption={typeOption}
              options={typeOptions}
              onChange={({ detail }) => {
                setTypeOption(detail.selectedOption);
                setPage(1);
              }}
              ariaLabel="Filter by hosted zone type"
            />
          </div>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pages}
            onChange={({ detail }) => setPage(detail.currentPageIndex)}
          />
        }
        preferences={
          <CollectionPreferences
            title="Preferences"
            confirmLabel="Confirm"
            cancelLabel="Cancel"
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 hosted zones" },
                { value: 20, label: "20 hosted zones" },
                { value: 50, label: "50 hosted zones" },
              ],
            }}
            preferences={{ pageSize }}
            onConfirm={({ detail }) => {
              setPageSize(detail.pageSize ?? 20);
              setPage(1);
            }}
          />
        }
        empty={
          <Box textAlign="center" color="inherit">
            <b>
              {search || typeOption.value ? "No matches" : "No hosted zones"}
            </b>
            <Box variant="p" color="inherit">
              {search || typeOption.value
                ? "Clear the filters and try again."
                : "Create a hosted zone to begin managing DNS records."}
            </Box>
            {!search && !typeOption.value && (
              <Button
                variant="primary"
                onClick={() => router.push("/route53/hosted-zones/create")}
              >
                Create hosted zone
              </Button>
            )}
          </Box>
        }
      />
      <Modal
        key="delete-hosted-zone-modal"
        visible={deleteOpen}
        onDismiss={() => setDeleteOpen(false)}
        header="Delete hosted zone"
        closeAriaLabel="Close"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button key="cancel" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                key="delete"
                loading={deleting}
                disabled={
                  confirmName !==
                  (selected.length === 1 ? selected[0]?.name : "DELETE")
                }
                onClick={() => void removeSelected()}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="s">
          <Box key="delete-warning" variant="p">
            Deleting{" "}
            {selected.length === 1 ? (
              <b>{selected[0]?.name}</b>
            ) : (
              <b>{selected.length} hosted zones</b>
            )}{" "}
            also permanently removes every DNS record.
          </Box>
          <FormField
            key="confirmation-input"
            label={
              <>
                Type{" "}
                <b>{selected.length === 1 ? selected[0]?.name : "DELETE"}</b> to
                confirm
              </>
            }
          >
            <Input
              value={confirmName}
              onChange={({ detail }) => setConfirmName(detail.value)}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
