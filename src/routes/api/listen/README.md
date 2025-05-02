# Listener SSE Endpoint (`/api/listen/[...slug]`)

This directory implements the Server-Sent Events (SSE) listener endpoint for real-time streaming to clients.

## Overview

- **Route:** `/api/listen/[...slug]`
- **Purpose:** Allows external applications or clients to establish a real-time SSE connection and receive events related to a specific listener (identified by `slug`).
- **Authentication:** Ensure proper authentication as required by your deployment.

## How It Works

1. **Client connects** via HTTP GET to `/api/listen/{slug}`.
2. The server authenticates and validates the listener.
3. If valid, the server opens an SSE stream and registers the connection.
4. Events related to the listener are pushed to the client as they occur.

## Testing

A simple test script is provided at [`tests/listen/test_listen.sh`](../../tests/listen/test_listen.sh):

```bash
curl -i -N -v http://localhost:5173/api/listen/<your-listener-slug>
```

- Replace `<your-listener-slug>` with the actual slug for your listener.
- The script uses `curl` to open and display the SSE stream.
- `-i` shows headers, `-N` disables buffering, and `-v` enables verbose output.

## Example Usage

```bash
sh ../../tests/listen/test_listen.sh
```

Or run manually:

```bash
curl -i -N -v http://localhost:5173/api/listen/m8yhng3w-bf3e9fd693974d66b88c84c2da1e851e
```

You should see HTTP headers followed by real-time event data as it is pushed from the server.

## Admin Interface

The admin interface for managing listeners is available at:

```
/admin/settings/listeners
```

Features include:

- View all listeners with their connections (webhooks and WhatsApp accounts)
- Create, edit, and delete listeners
- Toggle listener status (active/inactive)
- Copy endpoint URLs for integration
- View detailed connection information

The interface uses shadcn-svelte components for a consistent user experience, including:

- Skeleton loading states for better perceived performance
- Responsive design for all screen sizes
- Tooltips for additional information
- Badge indicators for connection counts
