# API Keys (IoT Management)

**Last Updated**: 2025-03-27  
**Audience**: End Users  
**Complexity**: Intermediate

## Overview

Under **IoT Management → API Keys**, you manage **account-level API keys**. These keys identify your **account** when calling supported **HTTP APIs** from scripts, integrations, or backend services—separately from logging into the web app.

They are **not** the same as:

- **Device API keys** shown on an individual **RDM device** detail page (used to authenticate that physical device).  
- **Admin** signing or system keys in the operator console.

## Prerequisites

- Access to **Settings → API Keys** (or the **IoT Management** shortcut; see Navigation)  
- Permission to create and revoke keys for the current account (as enforced by your deployment)  

## Navigation

- **Menu**: **IoT Management** → **API Keys**  
- **URL**: `/user/settings/api-keys`

The sidebar groups this under **IoT Management** next to Sensors, Templates, and Data, but the route lives under **settings** for technical reasons.

## What you can do

### List keys

- **Search** — Find keys by name.
- **Sort** — e.g. by name, created date, last used.
- **Pagination** — Browse large key lists.

Each row typically shows:

- **Name** — Label you chose for the integration.  
- **Masked key** — Only part of the secret is shown after creation; the full value is not stored in a way you can view again later.  
- **Permission** — e.g. **Read**, **Write**, or **Read & Write** (as offered in the UI).  
- **Created** / **Last used** — Audit-style timestamps.  
- **Status** — Active or inactive, depending on implementation.

### Create a key

1. Click **Add** (or equivalent).
2. Enter a **name** (required; length limits apply in the UI).
3. Choose a **permission** level.
4. Submit. The app shows the **full key once** in a confirmation dialog—**copy it immediately** and store it in a secure secret manager.

If you lose the secret, **regenerate** or create a new key; you cannot retrieve the old secret again.

### Copy and usage examples

- **Copy** — Copy the masked or full value where the UI allows (clipboard).
- **Usage example** — The page may offer a modal with **cURL** or other examples showing how to send the key, commonly as header:

  `x-api-key: <your-api-key>`

Follow the exact header name and URL paths from the in-app **Usage** modal or your organization’s API documentation.

### Regenerate

Regenerates the secret for an existing key record. Treat this as **rotating credentials**: update all integrations to use the new value immediately.

### Delete

Removes a key. Any client still using that key will receive **401 Unauthorized** (or equivalent) after deletion.

## Security practices

- Store keys only in **secret managers** or secure environment variables—not in source control or chat.  
- Use the **minimum permission** needed (read-only integrations should use Read).  
- **Rotate** keys periodically or when a team member who had access leaves.  
- **Revoke** unused keys.

## How this relates to IoT data

Account API keys may authenticate calls that read **sensor logs**, **paths**, or related endpoints scoped to your account. Exact endpoints and payloads are defined in your deployment; see internal API docs such as `docs/api/ACCOUNT_API_KEY_AUTHENTICATION.md` (repository path) if your team maintains them.

## Related features

- **[Data](./data.md)** — UI for the same radar data you might query via API.  
- **[Sensors](./sensors.md)** — Devices that produce data keys may access.  

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| 401 Unauthorized | Confirm the key is active, copied without spaces, and sent with the correct header name. |
| Wrong account data | Ensure integrations use the key for the intended **account** (switch account in the UI before creating keys if applicable). |
| Cannot see full key | Only shown at creation/regeneration; generate a new key if lost. |

---

**Status**: Describes account-level API key management under `/user/settings/api-keys` and its placement under IoT Management in the nav.
