# Production Deployment Guide

This document outlines the simplified deployment process for the FS04 Web Application in production environments. The application now uses Server-Sent Events (SSE) for real-time communication, making deployment more straightforward.

## Prerequisites

- Node.js 18 or later
- PostgreSQL database
- Redis (recommended for session storage)

## Deployment Options

### Option 1: Direct Deployment (Recommended)

1. **Install dependencies**:
   ```bash
   npm ci --production
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your production settings
   nano .env
   ```

3. **Build the application**:
   ```bash
   npm run build
   ```

4. **Run database migrations**:
   ```bash
   npx prisma migrate deploy
   ```

5. **Start the application**:
   ```bash
   # For production use
   node build
   
   # Or with process manager (PM2 recommended)
   npm install -g pm2
   pm2 start build --name "fs04-web"
   ```

### Option 2: Docker Deployment

1. **Build the Docker image**:
   ```dockerfile
   # Use Node.js 18 image
   FROM node:18-slim
   
   # Set working directory
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   
   # Install production dependencies
   RUN npm ci --production
   
   # Copy application files
   COPY . .
   
   # Build the application
   RUN npm run build
   
   # Expose the application port (default: 3000)
   EXPOSE 3000
   
   # Command to run the application
   CMD ["node", "build"]
   ```

2. **Build and run the container**:
   ```bash
   # Build the image
   docker build -t fs04-web .
   
   # Run the container
   docker run -d \
     --name fs04-web \
     -p 3000:3000 \
     --env-file .env \
     fs04-web
   ```

## Environment Variables

### Required Variables

```
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fs04_web

# Authentication
AUTH_SECRET=your-secret-key
AUTH_TRUST_HOST=true

# Redis (recommended for production)
REDIS_URL=redis://localhost:6379
```

### Optional Variables

```
# Logging
LOG_LEVEL=info

# CORS (comma-separated list of allowed origins)
CORS_ORIGIN=https://your-domain.com,https://app.your-domain.com

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # per window
```

## Monitoring

### Logging

Logs are output to `stdout` and can be captured by your process manager or container orchestration system.

### Metrics

For production monitoring, consider:

1. **Application Metrics**:
   - Use `prom-client` to expose Prometheus metrics
   - Set up Grafana dashboards

2. **Infrastructure Monitoring**:
   - CPU/Memory/Disk usage
   - Database performance metrics
   - Network traffic

### Health Checks

The application exposes a health check endpoint:

```
GET /health
```

## Scaling

The application is stateless and can be easily scaled horizontally:

1. **Load Balancing**: Use a reverse proxy like Nginx or a cloud load balancer
2. **Session Storage**: Ensure all instances use the same Redis instance for session storage
3. **File Storage**: Use a shared file system or cloud storage for file uploads

## Maintenance

### Database Migrations

To apply database migrations:

```bash
npx prisma migrate deploy
```

### Backups

Regularly backup your PostgreSQL database. Example backup command:

```bash
pg_dump -U username -d dbname > backup_$(date +%Y%m%d).sql
```

## Troubleshooting

Common issues and solutions:

1. **Application won't start**:
   - Check if all dependencies are installed
   - Verify environment variables are set correctly
   - Check if the database is accessible
   - Review application logs for errors

2. **Database connection issues**:
   - Verify database credentials in .env
   - Ensure the database server is running and accessible
   - Check for network/firewall issues

3. **Performance issues**:
   - Enable Redis caching
   - Check database query performance
   - Monitor server resources (CPU, memory, disk I/O)

## Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **CORS**: Configure CORS settings appropriately
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Security Headers**: Set appropriate security headers
5. **Regular Updates**: Keep dependencies updated

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
