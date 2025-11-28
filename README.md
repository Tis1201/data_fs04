# FS04 Web Application

[![CI](https://img.shields.io/github/actions/workflow/status/your-org/fs04_web/ci.yml?branch=main)](https://github.com/your-org/fs04_web/actions)
[![Coverage](https://img.shields.io/codecov/c/github/your-org/fs04_web)](https://codecov.io/gh/your-org/fs04_web)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Directory Structure](#directory-structure)
- [Contributing](#contributing)
- [License](#license)

## Overview

FS04 Web is a SvelteKit-based application for real-time video streaming, room management, and admin workflows using ZenStack, WebRTC, and RTP.

## Features

- Role-based access control with ZenStack-enhanced Prisma
- [Form handling with Zod and Superforms](./src/lib/components/ui_components_sveltekit/form/README.md)
- Real-time communication with Server-Sent Events (SSE)
- RTP and WebRTC streaming integration
- Admin dashboard and room management
- Event listener management with webhook and WhatsApp integrations
- Xterm terminal support (xterm-svelte)
- Responsive UI with Tailwind CSS & shadcn-svelte components
- Persistence via svelte-persisted-store
- Table utilities with svelte-headless-table
- Test data generation with @faker-js/faker

## Tech Stack

- Framework: SvelteKit, Vite, TypeScript
- Backend: ZenStack (Prisma) & LuciaAuth
- Validation: Zod & Superform
- UI: Tailwind CSS, shadcn-svelte, lucide icons
- Real-time: Server-Sent Events (SSE), WebRTC
- Testing: Vitest, Playwright
- Streaming: OpenCV, FFmpeg, RTP

## Prerequisites

- Node.js >= 18
- npm or yarn
- PostgreSQL database

## Getting Started

```bash
git clone <repository-url>
cd fs04_web
cp .env.example .env  # configure DATABASE_URL, PORT, NODE_ENV
npm install
npx prisma generate
npx zenstack generate
```

## Development

```bash
npm run dev  # starts Vite dev server
```

Open http://localhost:5173

## Testing

- Unit tests: `npm test`
- End-to-end tests: `npm run test:e2e`

## Deployment

See [PRODUCTION.md](./PRODUCTION.md) for production deployment instructions.

## Directory Structure

```
fs04_web/
├── src/
│   ├── routes/         # SvelteKit routes
│   ├── lib/            # utilities, stores, components
│   └── ...
├── prisma/             # database schema & migrations
├── docker/             # Docker files & examples
├── tests/              # additional test suites
└── ...
```

## Contributing

Contributions welcome! Please fork, branch, and submit pull requests. Adhere to existing conventions and ensure tests pass.

## Documentation

### Core Components
- [JWT Token Management](./src/lib/server/jwt_issuer/README.md) - Authentication and token handling
- [Device Management](./src/lib/server/device/README.md) - Device registration and management
- [Messaging System](./src/lib/server/messaging/README.md) - Real-time messaging infrastructure
- [WhatsApp Integration](./src/lib/server/whatsapp/README.md) - WhatsApp messaging capabilities

### UI Components
- [Form Handling](./src/lib/components/ui_components_sveltekit/form/README.md) - Comprehensive guide to form handling with validation and error handling

### UI Components
- [Admin Components](./src/lib/components/admin/README.md) - Reusable admin interface components
- [Form Components](./src/lib/components/ui_components_sveltekit/form/README.md) - Form building blocks and validation

### API & Infrastructure
- [API Listeners](./src/routes/api/listen/README.md) - Webhook and event listeners
- [Docker Setup](./docker/README.md) - Container configuration and deployment

### Testing
- [Rate Limit Testing](./tests/ratelimit/README.md) - Load and performance testing
- [WebRTC Testing](./tests/webrtc/README.md) - Video/audio streaming tests

## License

MIT License - see [LICENSE](LICENSE) for details.

## WebSocket Communication

The application uses a robust WebSocket-based communication pattern for real-time interactions with devices. The `sendRequest` method in `websocket-store.ts` provides a convenient way to send messages and wait for responses.

### `sendRequest` Pattern

The `sendRequest` method provides a request-response pattern over WebSockets with the following features:
- Automatic request ID generation and tracking
- Timeout handling
- Type-safe responses
- Error handling
- Request deduplication

### Basic Usage

```typescript
const response = await socketStore.sendRequest(
  {
    type: 'message-type',
    scope: 'subscription:scope',
    payload: {
      // Request data
    }
  },
  5000, // Timeout in milliseconds
  'request-prefix' // Optional prefix for request IDs
);
```

### Example: Pinging a Device

```typescript
async function pingDevice() {
  try {
    const response = await socketStore.sendRequest(
      {
        type: 'device',
        scope: `subscription:device:${deviceId}`,
        payload: {
          action: 'message',
          type: 'ping',
          deviceId: deviceId
        }
      },
      5000, // 5 second timeout
      'ping' // Request ID prefix
    );
    
    console.log('Ping successful:', response);
    return true;
  } catch (error) {
    console.error('Ping failed:', error);
    return false;
  }
}
```

### Error Handling

The `sendRequest` method will reject with an error in these cases:
- WebSocket is not connected
- Request times out (after the specified timeout)
- Server returns an error response
- Invalid response format

### Best Practices

1. Always use a descriptive request ID prefix for debugging
2. Set appropriate timeouts based on the expected operation duration
3. Handle both success and error cases
4. Use TypeScript types for request/response payloads
5. Clean up any pending requests when components unmount

### Core Architecture

### Messaging Core Components

| Component            | Role                                                                                   |
|---------------------|----------------------------------------------------------------------------------------|
| **Connection**         | Unified interface to send (or receive) messages via WS, SSE, Pushpin, etc.             |
| **ConnectionManager**  | Tracks connections and dispatches payloads to Connection.send()                        |
| **SharedStore**        | Central source of truth: who is connected where, with TTL and metadata                 |
| **Router**             | Resolves a scope (like room:abc123) to all relevant connection IDs                     |
| **ScopeAuthorizer**    | Enforces who is allowed to publish to what scope                                       |
| **Publisher**          | High-level message send function that routes → authorizes → dispatches                 |
| **MessageDispatcher**  | Handles incoming messages and routes to message-specific handlers                      |
| **MessageHandlers**    | Modular logic per message type (chat, webrtc, notify, webhook)                        |


### Server Context and Data Access

The application uses `locals` to store request-scoped data and services:

1. **App Locals**:
   - `locals.auth`: Authentication state and user info
   - `locals.prisma`: Zenstack-enhanced Prisma client
   - Access via `event.locals` in server-side code
   - Automatically includes user context for row-level security

2. **Zenstack-Enhanced Prisma**:
   - Automatically enforces access policies defined in schema
   - Provides row-level security based on user context
   - Handles complex data relationships
   - Example:
     ```typescript
     // Access through locals for automatic policy enforcement
     const data = await locals.prisma.user.findMany();
     
     // Direct prisma access should be avoided as it bypasses policies
     // const data = await prisma.user.findMany(); // Don't do this
     ```

### Security and Authorization

The application uses a robust security system built around three main components:

1. **Guards (`guards.ts`)**:
   - `restrict(handler, roles)`: Protects routes by role (e.g., ADMIN)
   - `restrictAuth(handler)`: Ensures user is authenticated
   - `unrestricted(handler)`: Explicitly marks public routes
   - Guards are higher-order functions that wrap route handlers to enforce security

2. **Role System**

The application implements a two-tiered role system to manage both system-wide and account-level access control:

#### System Roles (`SystemRole`)
System-wide roles that define global permissions across the entire application:

- `SUPER_ADMIN`: Full system access, can manage all accounts and system settings
- `ADMIN`: Can manage most system settings and users
- `USER`: Standard user with basic access

#### Account Roles (`AccountRole`)
Account-specific roles that define permissions within a particular account:

| Role      | Description                                      | Permissions                                                                 |
|-----------|--------------------------------------------------|-----------------------------------------------------------------------------|
| `OWNER`   | Full account ownership                          | All account actions, including billing, user management, and deletion       |
| `ADMIN`   | Account administrator                           | Manage users and settings, cannot delete account or change billing          |
| `MEMBER`  | Standard member                                 | Regular access to account features                                           |
| `GUEST`   | Limited access                                  | View-only access to specific resources                                      |

3. **Role-Based Access Control**:
   - Uses `SystemRole` and `AccountRole` enums for consistent role definition
   - Roles are checked at both route and data access levels
   - Example usage:
     ```typescript
     // System role check
     if (auth.systemRole === 'SUPER_ADMIN') {
         // System admin actions
     }
     
     // Account role check
     if (auth.accountRole === 'OWNER') {
         // Account owner actions
     }
     
     // Multiple role check
     const canEdit = ['OWNER', 'ADMIN'].includes(auth.accountRole);
     ```

### Data Access Patterns

1. **Form Actions Over API**:
   - **Preferred**: Use SvelteKit form actions for data mutations
   - Benefits:
     - Built-in CSRF protection
     - Progressive enhancement
     - Better error handling
     - Simpler client-side code
   - Example:
     ```typescript
     export const actions = {
       create: restrict(
         async ({ request, locals }) => {
           // Handle form submission
         },
         [SystemRole.ADMIN]
       )
     };
     ```

2. **Table Data Fetching**:
   - Uses `fetchTableData` utility for consistent data access
   - Integrates with Zenstack-enhanced Prisma through locals
   - Features:
     - Pagination
     - Sorting
     - Filtering
     - Search
     - Automatic policy enforcement
     - Row-level security
   - Example:
     ```typescript
     // fetchTableData automatically uses the enhanced Prisma client
     const result = await fetchTableData(locals, url, {
       modelName: 'user',
       searchableFields: ['email', 'name'],
       baseWhere: { /* base filters */ },
       include: { /* relations */ }
     });
     
     // The above is equivalent to but more convenient than:
     const data = await locals.prisma.user.findMany({
       where: { /* computed from url params + baseWhere */ },
       include: { /* relations */ },
       skip: (page - 1) * perPage,
       take: perPage,
       orderBy: { /* computed from url params */ }
     });
     ```

### Best Practices

1. **Route Protection**:
   - Always use guards on server-side routes
   - Combine with client-side navigation protection
   - Example:
     ```typescript
     export const load = restrict(
       async ({ locals }) => {
         // Protected route logic
       },
       [SystemRole.ADMIN]
     );
     ```

2. **Form Handling**:
   - Use Zod and Superforms for form validation and handling
   - Benefits:
     - Type-safe form schemas
     - Server-side validation
     - Progressive enhancement
     - Automatic error handling
   - Example:
     ```typescript
     // Schema definition
     const schema = z.object({
       email: z.string().email(),
       name: z.string().min(2)
     });

     // Server-side
     export const load = async () => {
       const form = await superValidate(schema);
       return { form };
     };

     // Form action
     export const actions = {
       default: async ({ request }) => {
         const form = await superValidate(request, schema);
         if (!form.valid) return fail(400, { form });
         // Handle form data
       }
     };
     ```

3. **Data Access**:
   - Use form actions for mutations (create, update, delete)
   - Use load functions with fetchTableData for queries
   - Always apply proper role restrictions
   - Use Zenstack-enhanced Prisma through locals

3. **API Endpoints**:
   - Only create API endpoints for:
     - External integrations
     - Real-time features
     - Complex data operations
   - Otherwise, prefer form actions

4. **Loading States**:
   - Use shadcn-svelte's Skeleton component for loading states
   - Benefits:
     - Prevents layout shifts
     - Provides subtle loading animation
     - Shows content structure before data loads
     - Improves perceived performance
     - Creates a smoother, more professional user experience

## Real-time Communication

### Server-Sent Events (SSE)

1. SSE is used for server-to-client real-time updates
2. Client connections are managed through `src/lib/stores/sse-store.ts`
3. To use SSE in a component:
   ```svelte
   import { sseStore } from '$lib/stores/sse-store';
   
   // Connect to SSE endpoint
   sseStore.connect('/api/sse');
   
   // Listen for messages
   const unsubscribe = sseStore.on('message', (data) => {
     console.log('Received:', data);
   });
   ```

### WebSocket (Deprecated)

> ⚠️ **Deprecation Notice**: WebSocket support has been deprecated in favor of Server-Sent Events (SSE).
> Existing WebSocket code is being phased out and will be removed in a future release.
> Please migrate to using SSE for real-time communication.

For reference, the deprecated WebSocket implementation was previously located in:
- `src/lib/server/websocket/` (server-side)
- `src/lib/stores/websocket-store.ts` (client-side)

## Production Deployment

In production, the real-time communication is handled through Server-Sent Events (SSE) which is natively supported by modern web servers and has better compatibility with HTTP/2.

2. **Custom Server**:
   - `prodServer.ts` creates an HTTP server with the SvelteKit handler
   - Attaches WebSocket server to the same HTTP server
   - Handles WebSocket upgrade requests

3. **ZenStack Integration**:
   - Custom build process copies ZenStack files to the production build
   - Ensures ZenStack's enhance function is available in production

## Deployment

### Production Deployment

To deploy the application to a production server:

1. **Prerequisites**:
   - Node.js 18+ installed on the server
   - PostgreSQL database accessible
   - Environment variables configured

2. **Deployment Steps**:
   ```bash
   # Clone the repository
   git clone <repository-url>
   cd fs04_web
   
   # Install dependencies
   npm install
   
   # Generate Prisma client and ZenStack files
   npx prisma generate
   npx zenstack generate
   
   # Build the application
   npm run build
   
   # Start the production server
   npm run prodServer
   ```

3. **Environment Variables**:
   - `DATABASE_URL`: PostgreSQL connection string
   - `PORT`: Server port (defaults to 3000)
   - `NODE_ENV`: Set to 'production'

4. **Using Process Managers**:
   For production deployments, use a process manager like PM2:
   ```bash
   # Install PM2
   npm install -g pm2
   
   # Start the application with PM2
   pm2 start npm --name "fs04_web" -- run prodServer
   
   # Ensure it starts on system reboot
   pm2 startup
   pm2 save
   ```

### Packaging for Deployment

To package the application for deployment as a zip file:

1. **Build and Package**:
   ```bash
   # Build the application
   npm run build
   
   # Create a deployment package
   mkdir -p deploy
   cp -r build package.json package-lock.json .env.example prodServer.ts deploy/
   cp -r node_modules/.zenstack deploy/node_modules/.zenstack
   cp -r node_modules/@zenstackhq deploy/node_modules/@zenstackhq
   cp -r node_modules/@prisma deploy/node_modules/@prisma
   
   # Create a zip file
   cd deploy
   zip -r ../fs04_web_deploy.zip .
   cd ..
   ```

2. **Server-Side Deployment**:
   ```bash
   # On the server
   mkdir -p app
   cd app
   
   # Unzip the deployment package
   unzip fs04_web_deploy.zip -d .
   
   # Install production dependencies
   npm install --production
   
   # Set up environment variables
   cp .env.example .env
   # Edit .env with your production settings
   nano .env
   
   # Start the production server
   NODE_ENV=production npm run prodServer
   # Or with PM2
   pm2 start npm --name "fs04_web" -- run prodServer
   ```

3. **Important Notes**:
   - The package includes only the necessary files for production
   - ZenStack and Prisma files are pre-generated and included
   - No need to run `zenstack generate` or `prisma generate` on the server
   - Environment variables must be configured on the server

## Development

## Project Status

### ✅ Completed Features
- **WebRTC Implementation**
  - Signaling server
  - Offer/Answer negotiation
  - Video streaming
  - Python to Go migration (Pion)
  - WebSocket optimization
  - WhatsApp key storage in SQL

- **Remote Terminal**
  - xterm-svelte integration
  - WebRTC data channel support
  - Terminal session management

### 🚧 In Progress / Planned

#### Core Platform
- **User Management**
  - User invitation system
    - JWT-based invite links
    - Email notifications
  - User lifecycle
    - Deactivation/Deletion (soft-delete)
    - Admin impersonation
    - Audit logging
    - Terms of Service acceptance tracking
    - GDPR compliance tools

- **Access Control**
  - Row-level security
  - Account-based permissions
  - Group-based access rules

#### Advanced Features
- **Computer Vision**
  - YOLO Open Vocabulary integration
  - OpenVINO optimization for Mac

- **System Architecture**
  - Batch processing framework
  - Resource management

### ❌ Deprecated/Removed
- Room Management System (replaced with direct addressing)
  - Room creation/deletion
  - User management
  - Session tracking
  - Resource limits

### 📝 Notes
- WebSocket routing now uses direct addressing instead of room-based system
- User management features are being consolidated into a single, comprehensive system



## UX and Layout
For admin, use AdminPageLayout
Always restrict user access to admin pages using restrict


## Row Based Security

This project implements fine-grained access control using Zenstack's row-level security. Here are the key policies in place:

### Resource Access Policies

1. **Creator Access**
   ```prisma
   // Allow users full CRUD on resources they created
   @@allow('read,update,delete', auth() != null && createdBy == auth().id)
   ```
   - Users can read, update, and delete resources they created
   - The `createdBy` field must match the authenticated user's ID

2. **Account Member Access**
   ```prisma
   // Allow read access to account members
   @@allow('read', auth() != null && account.members?[userId == auth().id])
   ```
   - Users can read any resource from accounts they are members of
   - Checks the account's members array for the current user's ID

### Key Concepts

- **`auth()`**: Represents the current authenticated user's context
- **`account.members`**: Relationship to the account's membership records
- **`?[]`**: Optional array access with filtering

### Example Flow

1. When a user attempts to access a resource:
   - The system first checks if they are the creator (full access)
   - If not, it checks if they are a member of the resource's account (read-only)
   - Admins have full access via separate policies

### Best Practices

- Always use `auth()` for access control rules
- Prefer explicit checks over wildcard permissions
- Test policies thoroughly with different user roles
- Document any complex access rules in this section

To Dos
Setup Wizard
- Create the 3 JWT keys
- Setup the admin user and password
- Setup email service provider
- Generate Device Factory Token
Access Management
- User Sign Up Form (user will have own account)
- User invite Team Members (use jwt with expiry,invited users will share account with owner)
- Reset Password Form (use jwt with expiry)
- use captcha-canvas for added security
- Rate Limiting:
- Implement rate limiting on login attempts
- Use IP-based blocking for suspicious activity

JWT Token Issuer
- Allow devices to request for JWT tokens using API keys
- Add token rotation 
- Add token revocation
- Add certificate rotation store in DB
- Add certificate rotation 

Audit Log
- sign in
- sign out
- user actions
- system actions
- sign in errors
- password reset etc

IOT
- Remove websocket comms
- Replace with SSE comms

Modules Access (subscription based)
- IOT
- Whatsapp
- Others in future


Remove Websocket (it sucks)
- Replace device communications with SSE
- Remove Websocket Middleware

Build
- Remove websocket middleware

Security
- Replace all with restrict
export const POST: RequestHandler = restrict(
    async ({ request, locals, auth }: any) => {





Notes
- When signing keys are rotated, factory tokens has to be regenerated as well


ToDos
- Devices will still use sse for registration/claim
- Devices will connect in using JWT and sse/pushpin by switching URL, switch is transparent
- Add Pre-claim
- Add Account_ID to connections (hydrate during connection creation in meta)
  - Users will be logging in with current chosen account
  - Devices will ever only belong to a account


npx prisma migrate dev --name add_new_tables

## Create PostgreSQL role for webapp access (secure setup)

The app (Prisma/Zenstack) should run with a least‑privilege role. Run the following as a superuser (e.g. `postgres`) in `psql`. Replace values as needed.

```sql
-- variables (for readability only)
-- database name: fs04_web
-- app role: webapp
-- strong password recommended

-- 1) Create login role (no superuser/createdb/createrole)
CREATE ROLE webapp WITH LOGIN PASSWORD 'change-me-strong-password';

-- Grant CREATEDB as required for this project workflow
ALTER ROLE webapp CREATEDB;

-- 2) (Optional but recommended) Use a dedicated schema owned by the app
-- If you prefer using public, skip this and keep grants on public only.
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION webapp;

-- 3) Allow connecting to the database
GRANT CONNECT ON DATABASE fs04_web TO webapp;

-- 4) Schema-level privileges
-- If using public schema for Prisma
GRANT USAGE, CREATE ON SCHEMA public TO webapp;
-- If using dedicated schema
GRANT USAGE, CREATE ON SCHEMA app TO webapp;

-- 5) Existing objects (in case tables/sequences already exist)
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public TO webapp;
GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA public TO webapp;
-- If using dedicated schema
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA app TO webapp;
GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA app TO webapp;

-- 6) Future objects (so new Prisma migrations work without extra grants)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO webapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO webapp;
-- If using dedicated schema
ALTER DEFAULT PRIVILEGES IN SCHEMA app
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES TO webapp;
ALTER DEFAULT PRIVILEGES IN SCHEMA app
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO webapp;
```

Notes
- For this project, `webapp` requires CREATEDB to support local workflows (e.g., Prisma creating the dev DB).
- Prisma Migrate requires `CREATE` on the target schema; the statements above grant it.
- Set your `.env` `DATABASE_URL` to use `webapp`:
  `postgresql://webapp:YOUR_PASSWORD@localhost:5432/fs04_web?schema=public` (or `schema=app` if you use the dedicated schema).

Run initial migration
```bash
npx prisma migrate dev --name init
```

Seed database
```bash
npm run db:seed
```






