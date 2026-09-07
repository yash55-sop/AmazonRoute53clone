# API

The REST base path is `/api/v1`. Health routes are public; authentication and Route 53 resources require the HTTP-only session cookie.

| Resource | Endpoints |
| --- | --- |
| Authentication | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Hosted zones | `GET/POST /hosted-zones`, `GET/PUT/DELETE /hosted-zones/{zone_id}` |
| Records | `GET/POST /hosted-zones/{zone_id}/records`, `GET/PUT/DELETE /hosted-zones/{zone_id}/records/{record_id}` |
| Bulk records | `POST /hosted-zones/{zone_id}/records/bulk-delete` |
| Zone files | `POST /hosted-zones/{zone_id}/records/import`, `GET /hosted-zones/{zone_id}/records/export?format=bind|json` |

Collection endpoints accept `search`, a resource type filter, `page`, `page_size`, `sort_by`, and `sort_order`. Responses contain `items`, `page`, `page_size`, `total`, and `pages`. Expected statuses include 200, 201, 204, 401, 404, 409, and 422. OpenAPI documentation is served at `/docs` while FastAPI is running.
