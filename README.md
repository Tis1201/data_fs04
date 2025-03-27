# FS04 Web Application

## Core Architecture

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

2. **Role-Based Access Control**:
   - Uses `SystemRole` enum for consistent role definition
   - Roles are checked at both route and data access levels
   - Example: `restrict(handler, [SystemRole.ADMIN])`

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

## WebSocket Implementation

The application includes a WebSocket server for real-time communication:

### Development Mode

In development mode, the WebSocket server is automatically attached to the Vite dev server:

1. WebSocket initialization happens in `src/lib/server/websocket/WebSocketUtils.ts`
2. Client connections are managed through `src/lib/stores/websocket-store.ts`
3. To use WebSockets in a component:
   ```svelte
   import { socketStore } from '$lib/stores/websocket-store';
   
   // Connect to WebSocket
   socketStore.connect();
   
   // Send a message
   socketStore.send({ type: 'message', content: 'Hello' });
   
   // Listen for messages
   $: messages = $socketStore.messages;
   ```

### Production Mode

In production, a custom server handles both HTTP and WebSocket connections:

1. **Build Process**:
   ```bash
   # Build the application with ZenStack support
   npm run build
   
   # Start the production server
   npm run prodServer
   ```

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
     - Shows content structure
     - Improves perceived performance
   - Example:
     ```svelte
     {#if loading}
       <div class="space-y-4">
         <Skeleton class="h-8 w-full" />
         <Skeleton class="h-4 w-3/4" />
       </div>
     {:else}
       <!-- Actual content -->
     {/if}
     ```

## Development

### To-dos
- Add WebRTC Signaling (done)
- Add WebRTC Offer/Answer (done)
- Add WebRTC Video (done)
- Convert to Pion from aoirtc python (done)
- Clean up websocket implementation
- Run yolo-openvobulary on openvino on mac
- Batch input architecture, some makes sense if input size is small
