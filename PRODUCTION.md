# Production Deployment Guide

This document outlines the best practices for deploying the FS04 Web Application to production environments.

## Deployment Options

### Option 1: Using the Deployment Package (Recommended)

1. **Create the deployment package**:
   ```bash
   npm run package
   ```
   This creates a `fs04_web_deploy.zip` file containing all necessary files.

2. **Transfer and unzip the package on your server**:
   ```bash
   scp fs04_web_deploy.zip user@your-server:/path/to/deploy/
   ssh user@your-server
   cd /path/to/deploy/
   unzip fs04_web_deploy.zip
   cd fs04_web_deploy
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your production settings
   nano .env
   ```

5. **Start the application**:
   ```bash
   # Run with database migrations (first time or after schema changes)
   RUN_MIGRATIONS=true ./start.sh
   
   # Run with database migrations and seed data (for empty database setup)
   RUN_MIGRATIONS=true RUN_SEED=true ./start.sh
   
   # Run without migrations (subsequent starts)
   ./start.sh
   ```
   
   > **Note**: The seed script creates an admin user and API key. When running with `RUN_SEED=true`, the console will display the generated API key. Make sure to save this key as it won't be displayed again.

### Option 2: Docker Deployment

1. **Create a Dockerfile in your project root**:
   ```dockerfile
   # Build stage
   FROM node:18 AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   # Production stage
   FROM node:18-slim
   WORKDIR /app
   COPY --from=build /app/build ./build
   COPY --from=build /app/package*.json ./
   COPY --from=build /app/schema.zmodel ./
   COPY --from=build /app/prisma ./prisma
   COPY --from=build /app/prodServer.js ./
   COPY --from=build /app/start.sh ./
   RUN chmod +x start.sh
   RUN npm ci --production
   
   # Generate ZenStack and Prisma files
   RUN npx zenstack generate
   RUN npx prisma generate

   # Start the server
   CMD ["./start.sh"]
   ```

2. **Build and run the Docker image**:
   ```bash
   docker build -t fs04-web-app .
   
   # Run normally
   docker run -p 3000:3000 --env-file .env fs04-web-app
   
   # Run with migrations
   docker run -p 3000:3000 --env-file .env -e RUN_MIGRATIONS=true fs04-web-app
   
   # Run with migrations and seed data (for empty database setup)
   docker run -p 3000:3000 --env-file .env -e RUN_MIGRATIONS=true -e RUN_SEED=true fs04-web-app
   ```
   
   > **Note**: When running with the seed option, check the container logs to capture the generated API key.

### Option 3: CI/CD Deployment (AWS, Azure, etc.)

1. **Set up your CI/CD pipeline** to:
   - Install dependencies
   - Run tests
   - Build the application
   - Generate ZenStack and Prisma files
   - Deploy to your hosting platform

2. **Example GitHub Actions workflow**:
   ```yaml
   name: Deploy
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '18'
         - run: npm ci
         - run: npm run build
         - run: npx zenstack generate
         - run: npx prisma generate
         # Deploy steps specific to your platform
   ```

## Production Best Practices

1. **Database Initialization**:
   - When setting up a fresh database, run migrations and seed the database with initial data:
     ```bash
     RUN_MIGRATIONS=true RUN_SEED=true ./start.sh
     ```
   - This will:
     - Apply all database migrations
     - Create an admin user (email: admin@example.com, password: admin123)
     - Generate and display an API key for WebSocket testing
   - **Important**: Save the generated API key as it will not be displayed again
   - Change the default admin password after the first login

2. **Environment Variables**:
   - Never commit `.env` files to version control
   - Use different environment variables for development and production
   - Store sensitive information in a secure vault service

2. **Database Management**:
   - Always run migrations using `RUN_MIGRATIONS=true ./start.sh`
   - Back up your database before running migrations
   - Consider using a database service with automatic backups

3. **Process Management**:
   - Use PM2 or similar for process management:
     ```bash
     npm install -g pm2
     pm2 start ./start.sh --name "fs04-web"
     pm2 startup
     pm2 save
     ```

4. **Monitoring and Logging**:
   - Set up application monitoring
   - Configure proper logging
   - Set up alerts for critical errors

5. **Security**:
   - Set up a reverse proxy (Nginx, Apache) with HTTPS
   - Configure proper CORS settings
   - Implement rate limiting for API endpoints

## Troubleshooting

1. **Application won't start**:
   - Check if all dependencies are installed
   - Verify environment variables are set correctly
   - Check if the database is accessible

2. **Database connection issues**:
   - Verify DATABASE_URL is correct
   - Check database server is running
   - Ensure firewall rules allow connections
   - For a fresh database setup, run migrations and seed data:
     ```bash
     RUN_MIGRATIONS=true RUN_SEED=true ./start.sh
     ```

3. **ZenStack or Prisma errors**:
   - Run `npx zenstack generate` manually
   - Run `npx prisma generate` manually
   - Check if schema.zmodel and schema.prisma are present

For more assistance, refer to the project documentation or contact the development team.
