"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Badge from "@cloudscape-design/components/badge";
import Box from "@cloudscape-design/components/box";
import BreadcrumbGroup from "@cloudscape-design/components/breadcrumb-group";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import FileUpload from "@cloudscape-design/components/file-upload";
import Header from "@cloudscape-design/components/header";
import Modal from "@cloudscape-design/components/modal";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import Textarea from "@cloudscape-design/components/textarea";
import TextFilter from "@cloudscape-design/components/text-filter";
import { recordsApi, zonesApi } from "@/lib/api/route53";
import type { DNSRecord, HostedZone } from "@/types/api";
import { useNotifications } from "@/components/shell/notifications";

const recordTypes: SelectProps.Options = [
  { label: "All record types", value: "" },
  ...["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA", "SOA"].map(
    (value) => ({ label: value, value }),
  ),
];

function isProtectedRecord(record: DNSRecord) {
  return record.is_system;
}

export function ZoneDetails() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [items, setItems] = useState<DNSRecord[]>([]);
  const [selected, setSelected] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeOption, setTypeOption] = useState<SelectProps.Option>(
    recordTypes[0],
  );
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [bindText, setBindText] = useState("");
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const importPreview = useMemo(() => {
    const lines = bindText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith(";") && !line.startsWith("$"));
    const invalid = lines.filter(
      (line) =>
        !/^(\S+)\s+(\d+)\s+IN\s+(A|AAAA|CNAME|TXT|MX|NS|PTR|SRV|CAA)\s+(.+)$/i.test(
          line,
        ),
    );
    return { count: lines.length, invalid: invalid.length };
  }, [bindText]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [zoneResult, recordResult] = await Promise.all([
        zonesApi.get(zoneId),
        recordsApi.list(zoneId, {
          search,
          recordType: typeOption.value,
          page,
          pageSize,
          sortBy,
          sortOrder,
        }),
      ]);
      setZone(zoneResult);
      setDescription(zoneResult.description ?? "");
      setItems(recordResult.items);
      setTotal(recordResult.total);
      setPages(Math.max(recordResult.pages, 1));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Hosted zone could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, sortBy, sortOrder, typeOption.value, zoneId]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function deleteRecord() {
    if (!selected.length) return;
    setDeleting(true);
    try {
      let result: { deleted: number; skipped: string[] };
      if (selected.length === 1) {
        await recordsApi.delete(zoneId, selected[0].record_id);
        result = { deleted: 1, skipped: [] };
      } else {
        result = await recordsApi.bulkDelete(
          zoneId,
          selected.map((record) => record.record_id),
        );
      }
      notify(
        result.skipped.length ? "warning" : "success",
        selected.length === 1
          ? `Record ${selected[0].name} (${selected[0].type}) was deleted.`
          : `${result.deleted} records were deleted.`,
        result.skipped.length
          ? `${result.skipped.length} unavailable record${result.skipped.length === 1 ? " was" : "s were"} skipped.`
          : undefined,
      );
      setSelected([]);
      setDeleteOpen(false);
      await load();
    } catch (reason) {
      notify(
        "error",
        "Could not delete record",
        reason instanceof Error ? reason.message : undefined,
      );
    } finally {
      setDeleting(false);
    }
  }
  async function saveZone() {
    if (!zone) return;
    try {
      const updated = await zonesApi.update(zoneId, { description });
      setZone(updated);
      setEditOpen(false);
      notify("success", "Hosted zone updated");
    } catch (reason) {
      notify(
        "error",
        "Could not update hosted zone",
        reason instanceof Error ? reason.message : undefined,
      );
    }
  }
  async function download(format: "json" | "bind") {
    if (!zone) return;
    const allRecords = await recordsApi.list(zoneId, { pageSize: 100 });
    const content =
      format === "json"
        ? JSON.stringify(allRecords.items, null, 2)
        : allRecords.items
            .map(
              (record) =>
                `${record.name}. ${record.ttl} IN ${record.type} ${record.value.replaceAll("\n", " ")}`,
            )
            .join("\n");
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "json" ? "application/json" : "text/plain",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${zone.name}.${format === "json" ? "json" : "zone"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function importRecords() {
    setImporting(true);
    try {
      const result = await recordsApi.importBind(zoneId, bindText);
      notify(
        "success",
        "Zone file imported",
        `${result.imported} records were created.`,
      );
      setImportOpen(false);
      setBindText("");
      setFiles([]);
      await load();
    } catch (reason) {
      notify(
        "error",
        "Import failed",
        reason instanceof Error ? reason.message : undefined,
      );
    } finally {
      setImporting(false);
    }
  }
  if (!zone && loading)
    return <Box textAlign="center">Loading hosted zone…</Box>;
  return (
    <SpaceBetween size="m">
      <BreadcrumbGroup
        items={[
          { text: "Route 53", href: "/route53/dashboard" },
          { text: "Hosted zones", href: "/route53/hosted-zones" },
          { text: zone?.name ?? zoneId, href: "#" },
        ]}
        onFollow={(e) => {
          if (e.detail.href !== "#") {
            e.preventDefault();
            router.push(e.detail.href);
          }
        }}
      />
      {error ? (
        <Box color="text-status-error">
          Error: {error}{" "}
          <Button variant="link" onClick={() => void load()}>
            Try again
          </Button>
        </Box>
      ) : null}
      <Header
        variant="h1"
        actions={
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setEditOpen(true)}>Edit hosted zone</Button>
            <Button onClick={() => router.push("/route53/hosted-zones")}>
              All hosted zones
            </Button>
          </SpaceBetween>
        }
      >
        {zone?.name}{" "}
        {zone && (
          <Badge color={zone.zone_type === "PUBLIC" ? "blue" : "grey"}>
            {zone.zone_type === "PUBLIC" ? "Public" : "Private"}
          </Badge>
        )}
      </Header>
      <Container header={<Header variant="h2">Hosted zone details</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">Hosted zone ID</Box>
            <div>{zone?.zone_id}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Type</Box>
            <div>
              {zone?.zone_type === "PUBLIC"
                ? "Public hosted zone"
                : "Private hosted zone"}
            </div>
          </div>
          <div>
            <Box variant="awsui-key-label">Record count</Box>
            <div>{total}</div>
          </div>
          <div>
            <Box variant="awsui-key-label">Description</Box>
            <div>{zone?.description || "–"}</div>
          </div>
        </ColumnLayout>
      </Container>
      <Table
        variant="container"
        stickyHeader
        stripedRows
        enableKeyboardNavigation
        selectionType="multi"
        trackBy="record_id"
        items={items}
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        loading={loading}
        loadingText="Loading DNS records"
        sortingColumn={{ sortingField: sortBy }}
        sortingDescending={sortOrder === "desc"}
        onSortingChange={({ detail }) => {
          setSortBy(detail.sortingColumn.sortingField ?? "name");
          setSortOrder(detail.isDescending ? "desc" : "asc");
        }}
        columnDefinitions={[
          {
            id: "name",
            header: "Record name",
            sortingField: "name",
            cell: (record) => record.name,
          },
          {
            id: "type",
            header: "Type",
            sortingField: "type",
            cell: (record) => record.type,
          },
          {
            id: "routing",
            header: "Routing policy",
            cell: () => "Simple",
          },
          {
            id: "alias",
            header: "Alias",
            cell: (record) => (record.is_alias ? "Yes" : "No"),
          },
          {
            id: "ttl",
            header: "TTL",
            sortingField: "ttl",
            cell: (record) => `${record.ttl} s`,
          },
          {
            id: "value",
            header: "Value / Route traffic to",
            cell: (record) => (
              <div className="record-value">{record.value}</div>
            ),
          },
        ]}
        header={
          <Header
            counter={`(${total})`}
            description="DNS records that control how traffic is routed for this hosted zone"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  iconName="refresh"
                  ariaLabel="Refresh records"
                  onClick={() => void load()}
                />
                <Button
                  disabled={
                    selected.length !== 1 || isProtectedRecord(selected[0])
                  }
                  onClick={() =>
                    router.push(
                      `/route53/hosted-zones/${zoneId}/records/${selected[0]?.record_id}/edit`,
                    )
                  }
                >
                  Edit
                </Button>
                <Button
                  disabled={
                    !selected.length || selected.some(isProtectedRecord)
                  }
                  disabledReason={
                    selected.some(isProtectedRecord)
                      ? "This record is managed by the hosted zone and cannot be deleted."
                      : undefined
                  }
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete record
                </Button>
                <Button onClick={() => setImportOpen(true)}>
                  Import zone file
                </Button>
                <Button onClick={() => void download("json")}>
                  Export JSON
                </Button>
                <Button onClick={() => void download("bind")}>
                  Export BIND
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    router.push(
                      `/route53/hosted-zones/${zoneId}/records/create`,
                    )
                  }
                >
                  Create record
                </Button>
              </SpaceBetween>
            }
          >
            Records
          </Header>
        }
        filter={
          <div className="table-filters">
            <TextFilter
              filteringText={search}
              filteringPlaceholder="Find records"
              filteringAriaLabel="Filter DNS records"
              onChange={({ detail }) => {
                setSearch(detail.filteringText);
                setPage(1);
              }}
            />
            <Select
              selectedOption={typeOption}
              options={recordTypes}
              onChange={({ detail }) => {
                setTypeOption(detail.selectedOption);
                setPage(1);
              }}
              ariaLabel="Filter by record type"
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
                { value: 10, label: "10 records" },
                { value: 20, label: "20 records" },
                { value: 50, label: "50 records" },
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
          <Box textAlign="center">
            <b>
              {search || typeOption.value
                ? "No matching records"
                : "No records"}
            </b>
            <Box variant="p">
              {search || typeOption.value
                ? "Clear the filters and try again."
                : "Create a record to route traffic."}
            </Box>
          </Box>
        }
      />
      <Modal
        visible={deleteOpen}
        onDismiss={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        header={selected.length === 1 ? "Delete record?" : "Delete records?"}
        closeAriaLabel="Close"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button disabled={deleting} onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={deleting}
                disabled={deleting}
                onClick={() => void deleteRecord()}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {selected.length === 1 ? (
          <SpaceBetween size="s">
            <Box variant="p">
              You are about to delete this DNS record. This action cannot be
              undone.
            </Box>
            <ColumnLayout columns={1} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Record</Box>
                <div>{selected[0]?.name}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Type</Box>
                <div>{selected[0]?.type}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">Value</Box>
                <div className="record-value">{selected[0]?.value}</div>
              </div>
            </ColumnLayout>
          </SpaceBetween>
        ) : (
          <Box variant="p">
            Delete <b>{selected.length} selected records</b>? DNS traffic may
            stop resolving as expected.
          </Box>
        )}
      </Modal>
      <Modal
        visible={editOpen}
        onDismiss={() => setEditOpen(false)}
        header="Edit hosted zone"
        closeAriaLabel="Close"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => void saveZone()}>
                Save changes
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField
          label="Description"
          description="Optional description for this hosted zone"
        >
          <Textarea
            value={description}
            onChange={({ detail }) => setDescription(detail.value)}
          />
        </FormField>
      </Modal>
      <Modal
        visible={importOpen}
        onDismiss={() => setImportOpen(false)}
        header="Import zone file"
        closeAriaLabel="Close"
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                loading={importing}
                disabled={!bindText.trim() || importPreview.invalid > 0}
                onClick={() => void importRecords()}
              >
                Import records
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="s">
          <Box variant="p">
            Paste BIND records using: name, TTL, IN, type, and value. Comments
            beginning with ; are ignored.
          </Box>
          <FileUpload
            value={files}
            accept=".txt,.zone,text/plain"
            onChange={({ detail }) => {
              setFiles(detail.value);
              const file = detail.value[0];
              if (file) void file.text().then(setBindText);
            }}
            i18nStrings={{
              uploadButtonText: () => "Choose zone file",
              dropzoneText: () => "Drop a zone file here",
              removeFileAriaLabel: (_, name) => `Remove ${name}`,
            }}
            constraintText="Text or .zone files"
          />
          <Textarea
            value={bindText}
            onChange={({ detail }) => setBindText(detail.value)}
            rows={10}
            placeholder={`${zone?.name}. 300 IN A 192.0.2.10`}
          />
          {bindText ? (
            <Box
              color={
                importPreview.invalid
                  ? "text-status-error"
                  : "text-status-success"
              }
            >
              {importPreview.count} record line
              {importPreview.count === 1 ? "" : "s"} detected
              {importPreview.invalid
                ? `; ${importPreview.invalid} invalid`
                : "; ready to import"}
              .
            </Box>
          ) : null}
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
}
