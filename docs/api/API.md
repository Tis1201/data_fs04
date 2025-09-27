# API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Server-Sent Events (SSE)](#server-sent-events-sse)
  - [WhatsApp Webhook](#whatsapp-webhook)
  - [Device JWT](#device-jwt)

## Authentication & Authorization

All API endpoints require authentication unless explicitly marked as public. The system uses a role-based access control (RBAC) system with the following roles:
- `SUPER_ADMIN`: Full system access
- `ADMIN`: Administrative access within their account
- `USER`: Standard user access

### Authentication Methods

#### Session Authentication
```http
GET /api/endpoint
Cookie: session=your_session_cookie
```

#### JWT Authentication
```http
GET /api/endpoint
Authorization: Bearer your_jwt_token
```

### Role-Based Access Control

API endpoints are protected using the `restrict` decorator which ensures only users with the required roles can access them:

```typescript
// Example: Allow both ADMIN and USER roles
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const GET = restrict(
  async ({ request, locals, auth }) => {
    // Your endpoint logic here
  },
  [SystemRole.ADMIN, SystemRole.USER] // Allowed roles
);
```

### Standard Response Format

All API responses follow a consistent format. The request handler receives the following parameters:

```typescript
async ({ request, locals, auth }: {
  request: Request;                   // Standard Fetch API Request object
  locals: App.Locals;                 // SvelteKit locals object
  auth: {                             // Authentication context
    user: {                           // Authenticated user
      id: string;                     // User ID
      // ... other user properties
    };
  };
}) => Promise<Response>
```

#### Success Response
```typescript
{
  success: true,
  data: T,          // Response data (type varies by endpoint)
  message?: string, // Optional success message
  requestId?: string // Unique request identifier for tracing
}
```

#### Error Response
```typescript
{
  success: false,
  error: {
    code: string;     // Error code (e.g., 'NOT_FOUND', 'VALIDATION_ERROR')
    message: string;  // User-friendly error message
    details?: string;  // Additional error details (in development only)
    stack?: string;   // Stack trace (in development only)
    requestId?: string; // Request identifier for support
  }
}
```

## Error Handling

The API uses a centralized error handling system that processes different types of errors and returns standardized responses.

### Standard Error Responses

#### 403 Forbidden
```json
{
  "success": false,
  "error": {
    "code": "ACCESS_POLICY_VIOLATION",
    "message": "You don't have permission to perform this action"
  }
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "Expected type, got value"
    }
  }
}
```

#### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found"
  }
}
```

### Error Handler Usage

Use the `handleApiError` utility for consistent error handling:

```typescript
import { handleApiError } from '$lib/server/errors/errorHandlers';

try {
  // Your code here
} catch (error) {
  return handleApiError({
    error,
    prisma: locals.prisma,
    defaultMessage: 'Failed to process request',
    action: 'processing data',
    status: 400 // Optional HTTP status code
  });
}
```

### Form Error Handling

For form submissions, use `handleFormError`:

```typescript
import { handleFormError } from '$lib/server/errors/errorHandlers';

try {
  // Process form
} catch (error) {
  return handleFormError({
    error,
    form: formData,
    prisma: locals.prisma,
    defaultMessage: 'Failed to save form',
    action: 'saving form data'
  });
}
```

### Error Handler Functions

#### `handleApiError(options)`

Standard error handler for API endpoints that returns JSON responses.

**Options:**
- `error`: The caught error object
- `prisma`: Optional Prisma client for database lookups
- `accountId`: Optional account ID for access policy context
- `defaultMessage`: Fallback error message
- `status`: HTTP status code (default: 500)
- `requestId`: Request identifier for tracing
- `action`: Description of the action being performed

#### `handleFormError(options)`

Specialized handler for form submissions that cleans form data and returns validation errors.

**Options:**
- All options from `handleApiError`
- `form`: The form data to clean and return
- `action`: Description of the form action

#### `handleFormApiError(options)`

Combined handler that can return either form errors or API responses based on the `apiResponse` flag.

## API Response Types

The API uses a set of TypeScript types and utilities to ensure consistent response formats. These are available in `$lib/server/types/api`.

### Core Types

#### `ApiResponse<T>`
Base interface for all API responses.

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  requestId?: string;
  timestamp?: string;
}
```

#### `ApiSuccessResponse<T>`
For successful responses with typed data.

```typescript
interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
  timestamp: string;
}
```

#### `ApiErrorResponse`
For error responses with standardized error structure.

```typescript
interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
  requestId?: string;
  timestamp: string;
}
```

### Helper Functions

#### `createSuccessResponse<T>(data: T, options?)`
Creates a properly typed success response.

```typescript
const response = createSuccessResponse(data, {
  message: 'Operation successful',
  requestId: 'req_123'
});
```

#### `createErrorResponse(error, options?)`
Creates a properly typed error response.

```typescript
const errorResponse = createErrorResponse(error, {
  code: 'NOT_FOUND',
  details: { id: '123' },
  includeStack: process.env.NODE_ENV === 'development'
});
```

### Example Usage

#### Basic API Endpoint

```typescript
import { json } from '@sveltejs/kit';
import { createSuccessResponse, createErrorResponse } from '$lib/server/types/api';
import { restrict } from '$lib/server/security/guards';
import { SystemRole } from '$lib/types/roles';

export const GET = restrict(
  async ({ locals, auth }: any) => {
    try {
      const data = await getDataFromDatabase();
      return json(createSuccessResponse(data));
    } catch (error) {
      return json(createErrorResponse(error, {
        code: 'DATA_FETCH_ERROR'
      }), { status: 500 });
    }
  },
  [SystemRole.ADMIN, SystemRole.USER]
);
```

#### With Form Handling

```typescript
import { superValidate } from 'sveltekit-superforms/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

export const actions = {
  default: restrict(
    async ({ request, locals }) => {
      const form = await superValidate(request, schema);
      
      if (!form.valid) {
        return fail(400, { form });
      }
      
      try {
        const result = await createItem(form.data);
        return message(form, createSuccessResponse(result, {
          message: 'Item created successfully'
        }));
      } catch (error) {
        return handleFormError({
          error,
          form,
          prisma: locals.prisma,
          defaultMessage: 'Failed to create item'
        });
      }
    },
    [SystemRole.ADMIN]
  )
};
```

### Standard Error Codes

The API uses the following standard error codes:

```typescript
export const ErrorCode = {
  // General errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  
  // Authentication
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Prisma errors
  PRISMA_UNIQUE_CONSTRAINT: 'P2002',
  PRISMA_RECORD_NOT_FOUND: 'P2025',
  // ... other error codes
} as const;
```

### Type Guards

Use these to check response types:

```typescript
import { isSuccessResponse, isErrorResponse } from '$lib/server/types/api';

const response = await fetch('/api/data');
const result = await response.json();

if (isSuccessResponse(result)) {
  // TypeScript knows result is ApiSuccessResponse
  console.log(result.data);
} else if (isErrorResponse(result)) {
  // TypeScript knows result is ApiErrorResponse
  console.error(result.error.message);
}
```
```

### Best Practices
1. Always wrap API logic in try/catch blocks
2. Use specific error handlers based on the context (API vs Form)
3. Include meaningful error messages and context
4. Log detailed errors server-side but return sanitized messages to clients

## API Endpoints

### Server-Sent Events (SSE)

#### GET /api/sse

Establishes a Server-Sent Events (SSE) connection for real-time communication between the server and web clients.

**Authentication**
- Required: Yes
- Type: Session or JWT
- Roles: `ADMIN`, `USER`

**Response**
- Content-Type: `text/event-stream`
- Headers:
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`

**Events**
1. **connected**
   - Sent upon successful connection
   - Data: 
     ```json
     {
       "connectionId": "unique-connection-id",
       "timestamp": "2025-06-28T03:57:29.000Z"
     }
     ```

**Connection Management**
- Automatic connection management
- Automatic cleanup on disconnect
- Unique `connectionId` per connection

### WhatsApp API

#### POST /api/whatsapp/message

Sends a WhatsApp message to the specified recipient.

**Authentication**
- Required: Yes
- Roles: `ADMIN`

**Request Headers**
```
Content-Type: application/json
Authorization: Bearer <jwt_token>
```

**Request Body**
```typescript
{
  "clientId": string,     // WhatsApp client ID
  "recipient": string,    // Recipient phone number in international format
  "message": string       // Message content to send
}
```

**Response**
- 200 Success
```typescript
{
  "success": true,
  "message": "Message sent",
  "data": {
    "messageId": string,  // Unique message ID
    "status": "sent",     // Message status
    "timestamp": string   // ISO timestamp
  },
  "timestamp": string
}
```

**Error Responses**
- 400 Bad Request: Invalid request body or missing required fields
- 401 Unauthorized: Missing or invalid authentication
- 403 Forbidden: Insufficient permissions
- 500 Internal Server Error: Failed to send message

### WhatsApp Webhook

#### POST /api/whatsapp

Handles incoming WhatsApp webhook events.

**Authentication**
- Required: Yes
- Type: API Key (X-API-Key header)

**Request Body**
```json
{
  "event": "message_received",
  "data": {
    "from": "+1234567890",
    "message": "Hello, World!"
  }
}
```

**Response**
- Content-Type: `application/json`
- Status: `200 OK` on success

### Device JWT

#### POST /api/device/jwt

Generates a JWT token for device authentication.

**Authentication**
- Required: Yes
- Type: Session or Basic Auth
- Roles: `ADMIN`, `DEVICE`

**Request Body**
```json
{
  "deviceId": "device-123",
  "permissions": ["read:data", "write:data"]
}
```

**Response**
- Content-Type: `application/json`
- Status: `201 Created` on success
- Body:
  ```json
  {
    "success": true,
    "data": {
      "token": "generated.jwt.token",
      "expiresIn": 3600
    }
  }
  ```

#### Example Usage
```javascript
const eventSource = new EventSource('/api/sse', {
  withCredentials: true  // Include cookies for authentication
});

eventSource.onopen = () => {
  console.log('SSE connection established');
};

eventSource.onmessage = (event) => {
  console.log('Received message:', event.data);
};

eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  eventSource.close();
};

// To close the connection when done
// eventSource.close();
```

#### Implementation Details
- The endpoint uses SvelteKit's server-side routing
- Connections are managed by the `ConnectionManager` class
- Each connection is an instance of `SSEConnection`
- Messages are dispatched using the `MessageDispatcher`
- The implementation supports both admin and regular user roles

#### Security Considerations
- All connections require authentication
- Messages are scoped to the authenticated user
- Connection lifecycle is properly managed to prevent resource leaks
- The endpoint implements proper CORS and security headers