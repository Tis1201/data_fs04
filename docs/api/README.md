# API Documentation

This folder contains API documentation and authentication details for the IoT Management System.

## 📋 Documents

### [API Reference](./API.md)
Complete API endpoint documentation including:
- **REST Endpoints**: All HTTP API endpoints
- **Request/Response Formats**: Detailed payload specifications
- **Authentication**: API authentication methods
- **Error Handling**: Comprehensive error responses
- **Rate Limiting**: API usage limits and throttling

### [JWT Authentication](./JWT.md)
JSON Web Token implementation and usage:
- **Token Generation**: JWT token creation and validation
- **Authentication Flow**: Complete authentication process
- **Security Features**: Token security and protection
- **Refresh Tokens**: Token refresh mechanisms
- **Error Handling**: Authentication error scenarios

## 🔌 API Overview

### REST API
The system provides a comprehensive REST API for:
- **Device Management**: CRUD operations for devices
- **User Management**: User account and authentication
- **Bundle Management**: Bundle creation and deployment
- **Resource Management**: File and resource handling
- **Status Monitoring**: Real-time status updates

### WebSocket API
Real-time communication through WebSocket connections:
- **Device Communication**: Direct device messaging
- **Status Updates**: Real-time status broadcasting
- **Command Dispatch**: Remote command execution
- **Event Streaming**: Live event streaming

### Server-Sent Events (SSE)
One-way real-time communication:
- **Status Updates**: Live status updates
- **Progress Tracking**: Real-time progress updates
- **Notifications**: System notifications
- **Event Broadcasting**: Event distribution

## 🔐 Authentication

### JWT Tokens
```typescript
// Token generation
const token = jwt.sign(
  { userId: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

// Token validation
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### API Keys
```typescript
// Device API key validation
const device = await prisma.device.findUnique({
  where: { apiKey: request.headers['x-api-key'] }
});
```

### Session Management
```typescript
// Session creation
const session = await prisma.session.create({
  data: {
    userId: user.id,
    token: sessionToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
});
```

## 📊 API Endpoints

### Device Management
```http
GET    /api/devices              # List devices
POST   /api/devices              # Create device
GET    /api/devices/:id          # Get device
PUT    /api/devices/:id          # Update device
DELETE /api/devices/:id          # Delete device
```

### Bundle Management
```http
GET    /api/bundles              # List bundles
POST   /api/bundles              # Create bundle
GET    /api/bundles/:id          # Get bundle
PUT    /api/bundles/:id          # Update bundle
DELETE /api/bundles/:id          # Delete bundle
POST   /api/bundles/:id/publish  # Publish bundle
```

### User Management
```http
GET    /api/users                # List users
POST   /api/users                # Create user
GET    /api/users/:id            # Get user
PUT    /api/users/:id            # Update user
DELETE /api/users/:id            # Delete user
```

### Authentication
```http
POST   /api/auth/login           # User login
POST   /api/auth/logout          # User logout
POST   /api/auth/refresh         # Refresh token
POST   /api/auth/register        # User registration
```

## 📝 Request/Response Formats

### Standard Request Format
```typescript
interface APIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: {
    'Authorization': string;
    'Content-Type': string;
    'X-API-Key'?: string;
  };
  body?: any;
  query?: Record<string, string>;
}
```

### Standard Response Format
```typescript
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}
```

## 🔒 Security Features

### Authentication
- **JWT Tokens**: Secure token-based authentication
- **API Keys**: Device-specific API keys
- **Session Management**: Secure session handling
- **Refresh Tokens**: Automatic token refresh

### Authorization
- **Role-based Access**: User role permissions
- **Resource Ownership**: Ownership validation
- **Permission Checks**: Granular permission system
- **Audit Logging**: Complete access audit trail

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Cross-site scripting prevention
- **CSRF Protection**: Cross-site request forgery prevention

## 📊 Rate Limiting

### API Rate Limits
- **Authentication**: 5 requests per minute
- **Device Management**: 100 requests per minute
- **Bundle Management**: 50 requests per minute
- **User Management**: 200 requests per minute
- **General API**: 1000 requests per hour

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## 🧪 Testing

### API Testing
- **Unit Tests**: Individual endpoint testing
- **Integration Tests**: End-to-end API testing
- **Load Tests**: Performance and scalability testing
- **Security Tests**: Vulnerability assessment

### Test Tools
- **Postman**: API testing and documentation
- **Jest**: Unit testing framework
- **Supertest**: HTTP assertion library
- **Artillery**: Load testing tool

### Test Data
- **Mock Data**: Test data generation
- **Test Users**: Test user accounts
- **Test Devices**: Test device configurations
- **Test Scenarios**: Various test cases

## 🚀 Getting Started

1. **Authentication**: Set up JWT authentication
2. **API Keys**: Configure device API keys
3. **Endpoints**: Review available endpoints
4. **Testing**: Use provided test tools
5. **Integration**: Integrate with your application

## 📈 API Versioning

### Version Strategy
- **URL Versioning**: `/api/v1/endpoint`
- **Header Versioning**: `Accept: application/vnd.api+json;version=1`
- **Backward Compatibility**: Maintain backward compatibility
- **Deprecation Policy**: Clear deprecation timeline

### Version History
- **v1.0**: Initial API release
- **v1.1**: Added batch processing endpoints
- **v1.2**: Enhanced error handling
- **v1.3**: Added real-time features

## 🔄 Webhook Integration

### Webhook Events
- **Device Status**: Device online/offline events
- **Bundle Progress**: Bundle installation progress
- **User Actions**: User activity events
- **System Events**: System status changes

### Webhook Format
```typescript
interface WebhookPayload {
  event: string;
  timestamp: string;
  data: any;
  signature: string;
}
```

## 📊 Monitoring and Analytics

### API Metrics
- **Request Count**: Total API requests
- **Response Time**: Average response time
- **Error Rate**: Error percentage
- **Throughput**: Requests per second

### Monitoring Tools
- **Application Metrics**: Custom metrics
- **Health Checks**: API health monitoring
- **Alerting**: Automated alerting system
- **Dashboards**: Real-time monitoring dashboards

---

*For detailed API specifications, see the individual API documents.*
