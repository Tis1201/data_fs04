# CDN Architecture (Cloudflare R2)

This document describes the architecture and integration of the Content Delivery Network (CDN) using Cloudflare R2 storage and Cloudflare CDN services.

## 📋 Overview

The system uses **Cloudflare R2** as its primary object storage backend, providing S3-compatible storage with zero egress fees. Content is delivered through **Cloudflare CDN**, which provides globally distributed edge caching and security.

### Key Components

- **Cloudflare R2**: Object storage for assets (firmware, media, logs, etc.).
- **Cloudflare CDN**: Edge delivery layer for low latency and caching.
- **Cloudflare WAF**: Security layer implementing HMAC-based download authentication.
- **S3 SDK**: Node.js integration for managing R2 objects and generating presigned URLs.

## 🔐 Authentication & Security

The CDN implements two distinct authentication flows for security:

### 1. Uploads (Presigned URLs — Direct to Bucket)
**Uploads must go directly to the R2 bucket, never through the CDN.**
- The Web App generates a **Presigned PUT URL** using the R2 Access Key and Secret (S3 SDK with `CLOUDFLARE_R2_ENDPOINT`).
- The signed URL points to the R2 bucket endpoint (e.g. `*.r2.cloudflarestorage.com`).
- The client performs a standard `PUT` request to this URL — traffic goes direct to R2, not CDN.
- No master credentials ever leave the server environment.
- Reference implementation: `upload-with-signed-url.js`.

### 2. Downloads (HMAC Authentication)
Public downloads are secured via **HMAC authentication** handled at the Cloudflare edge (WAF):
- The application generates a message composed of `filePath + timestamp`.
- An HMAC-SHA256 signature is generated using a shared secret (`CLOUDFLARE_R2_ACCESS_HMAC`).
- Requests to the CDN must include `x-timestamp` and `x-mac` headers.
- Cloudflare WAF validates the signature before serving the content from cache or origin.

#### Device HMAC Download Payload

For device actions (install app, push file), when `CLOUDFLARE_R2_CDN_URL` and `CLOUDFLARE_R2_ACCESS_HMAC` are configured, the server returns HMAC auth instead of presigned URLs. The action payload includes:

```json
{
  "downloadUrl": "https://cdn.example.com/resources/file.deb",
  "downloadAuth": {
    "type": "hmac",
    "timestamp": "1709876543",
    "mac": "<base64-hmac-sha256>"
  }
}
```

The device must:
1. Fetch `downloadUrl` with HTTP `GET`
2. Include headers: `x-timestamp` (value from `downloadAuth.timestamp`) and `x-mac` (value from `downloadAuth.mac`)
3. Not include query parameters on the URL

## 🔄 Data Flows

### Upload Flow
```mermaid
sequenceDiagram
    participant Client
    participant WebApp
    participant R2
    
    Client->>WebApp: Request Upload Ticket
    WebApp->>WebApp: Generate Presigned PUT URL
    WebApp-->>Client: Return Signed URL
    Client->>R2: PUT file via Signed URL
    R2-->>Client: 200 OK
```

### Download Flow (Authenticated)
```mermaid
sequenceDiagram
    participant Client
    participant CDN as Cloudflare CDN (Edge)
    participant R2 as R2 Origin
    
    Client->>CDN: GET /path/to/file (headers: x-timestamp, x-mac)
    CDN->>CDN: Validate HMAC (WAF Rule)
    alt Valid Signature
        alt Cache HIT
            CDN-->>Client: Return cached content
        else Cache MISS
            CDN->>R2: Fetch object
            R2-->>CDN: Return object
            CDN-->>Client: Return content + Cache header
        end
    else Invalid Signature
        CDN-->>Client: 403 Forbidden
    end
```

## 🛠️ Configuration

### Environment Variables

The following variables are required for CDN operations:

| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_R2_BUCKET_NAME` | The name of the R2 bucket |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | R2 Access Key |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `CLOUDFLARE_R2_ENDPOINT` | R2 S3-compatible endpoint URL |
| `CLOUDFLARE_R2_ACCESS_HMAC` | Shared secret for HMAC generation |

### CDN URLs
- **Upload (direct to bucket)**: Presigned URL targets R2 endpoint (`CLOUDFLARE_R2_ENDPOINT`) — never use CDN for uploads.
- **Internal/Direct**: `${CLOUDFLARE_R2_ENDPOINT}/${BUCKET_NAME}/${KEY}`
- **Public/CDN (downloads only)**: `https://cdn-dev.datarealities.com/${KEY}`

## 🧪 Testing

- **Reference implementation**: `upload-with-signed-url.js` — CLI example for upload via signed URL direct to R2 bucket.
- **E2E test**: `tests/integrations/cloudflare/cloudflare_r2_e2e.test.ts` — follows the same pattern (S3Client + CLOUDFLARE_R2_ENDPOINT, getSignedUrl, fetch PUT).

These tests verify:
1. Signed URL generation.
2. Successful upload to R2.
3. HMAC generation and authenticated download.

To run the tests:
```bash
npx dotenv-cli -- vitest run tests/integrations/cloudflare/cloudflare_r2_e2e.test.ts
```
