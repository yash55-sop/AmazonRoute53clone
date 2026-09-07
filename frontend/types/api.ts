export interface HealthResponse {
  status: "ok";
}

export interface AuthUser {
  id: number;
  username: string;
  created_at: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export type ZoneType = "PUBLIC" | "PRIVATE";
export type RecordType =
  "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "PTR" | "SRV" | "CAA" | "SOA";

export interface HostedZone {
  zone_id: string;
  name: string;
  description: string | null;
  zone_type: ZoneType;
  record_count: number;
  created_at: string;
  updated_at: string;
}

export interface DNSRecord {
  record_id: string;
  name: string;
  type: RecordType;
  value: string;
  ttl: number;
  routing_policy: "SIMPLE";
  is_alias: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface ZoneInput {
  name: string;
  description?: string;
  zone_type: ZoneType;
}
export interface RecordInput {
  name: string;
  type: RecordType;
  value: string;
  ttl: number;
  routing_policy: "SIMPLE";
  is_alias: boolean;
}
