import { apiRequest } from "./client.ts";
import type {
  DNSRecord,
  HostedZone,
  PageResponse,
  RecordInput,
  ZoneInput,
} from "../../types/api.ts";

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(
    ([key, value]) =>
      value !== undefined && value !== "" && query.set(key, String(value)),
  );
  return query.toString();
}

export interface ListOptions {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}
export interface ZoneListOptions extends ListOptions {
  zoneType?: string;
}
export interface RecordListOptions extends ListOptions {
  recordType?: string;
}

export const zonesApi = {
  list(options: ZoneListOptions = {}) {
    const query = queryString({
      search: options.search,
      zone_type: options.zoneType,
      page: options.page,
      page_size: options.pageSize,
      sort_by: options.sortBy,
      sort_order: options.sortOrder,
    });
    return apiRequest<PageResponse<HostedZone>>(`/hosted-zones?${query}`);
  },
  get(zoneId: string) {
    return apiRequest<HostedZone>(`/hosted-zones/${zoneId}`);
  },
  create(input: ZoneInput) {
    return apiRequest<HostedZone>("/hosted-zones", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(zoneId: string, input: Partial<ZoneInput>) {
    return apiRequest<HostedZone>(`/hosted-zones/${zoneId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },
  delete(zoneId: string) {
    return apiRequest<void>(`/hosted-zones/${zoneId}`, { method: "DELETE" });
  },
};

export const recordsApi = {
  list(zoneId: string, options: RecordListOptions = {}) {
    const query = queryString({
      search: options.search,
      record_type: options.recordType,
      page: options.page,
      page_size: options.pageSize,
      sort_by: options.sortBy,
      sort_order: options.sortOrder,
    });
    return apiRequest<PageResponse<DNSRecord>>(
      `/hosted-zones/${zoneId}/records?${query}`,
    );
  },
  get(zoneId: string, recordId: string) {
    return apiRequest<DNSRecord>(`/hosted-zones/${zoneId}/records/${recordId}`);
  },
  create(zoneId: string, input: RecordInput) {
    return apiRequest<DNSRecord>(`/hosted-zones/${zoneId}/records`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(zoneId: string, recordId: string, input: Partial<RecordInput>) {
    return apiRequest<DNSRecord>(
      `/hosted-zones/${zoneId}/records/${recordId}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
  },
  delete(zoneId: string, recordId: string) {
    return apiRequest<void>(`/hosted-zones/${zoneId}/records/${recordId}`, {
      method: "DELETE",
    });
  },
  importBind(zoneId: string, content: string) {
    return apiRequest<{ imported: number }>(
      `/hosted-zones/${zoneId}/records/import`,
      { method: "POST", body: JSON.stringify({ content }) },
    );
  },
  bulkDelete(zoneId: string, ids: string[]) {
    return apiRequest<{ deleted: number; skipped: string[] }>(
      `/hosted-zones/${zoneId}/records/bulk-delete`,
      { method: "POST", body: JSON.stringify({ ids }) },
    );
  },
};
