# Documentation

**Last Updated**: 2025-10-12  
**Status**: ✅ Professional & Consolidated

This directory contains comprehensive documentation for the IoT Management System. The documentation has been **professionally consolidated** into 4 main documents for easy navigation and maintenance.

---

## 📚 Core Documentation

### 🏗️ [System Architecture](./architecture/system/SYSTEM_ARCHITECTURE.md)
**Complete system design and architecture**
- **Authentication & Authorization** - JWT, RBAC, and security
- **Database Architecture** - PostgreSQL, ClickHouse, and Redis
- **Real-Time Communication** - SSE, WebSocket, and Pushpin
- **Scalable Event Processing** - High-performance processing for 100k+ devices
- **Performance Architecture** - Caching, monitoring, and optimization
- **Deployment Architecture** - Kubernetes, Docker, and production setup

### 📡 [Real-Time Communication](./architecture/real-time/REAL_TIME_COMMUNICATION.md)
**SSE, WebSocket, WebRTC, and Pushpin implementation**
- **Server-Sent Events (SSE)** - Real-time device communication
- **Device SSE Implementation** - Complete device listen flow with API key auth
- **WebSocket Implementation** - Bidirectional communication
- **WebRTC Architecture** - Terminal and remote desktop
- **Pushpin Integration** - Message routing and proxy
- **Message Flow Examples** - Visual flow diagrams with file paths
- **Performance Optimization** - Connection pooling and load balancing

### 📱 [Device Management](./architecture/device/DEVICE_MANAGEMENT.md)
**Complete device flow and API reference**
- **Complete Device Flow** - Register → Listen → JWT token acquisition
- **Device Registration** - Factory JWT and PIN validation with SSE connection
- **Device Listening** - Real-time SSE communication for server commands
- **JWT Token Management** - API key authentication and token generation
- **Device Lifecycle** - Registration, claiming, and operations
- **Complete API Reference** - All device endpoints with examples
- **Server-to-Device Actions** - All actions server can send to devices
- **Device Response Patterns** - How devices respond to server actions
- **Code Examples** - Go and Python device client implementations
- **Security Features** - Multi-layer security and validation

### 🔧 [Troubleshooting](./TROUBLESHOOTING.md)
**All fixes, debugging guides, and performance optimization**
- **Critical Issues & Fixes** - Device connection, WebSocket, and HTTP/2 fixes
- **Common Issues & Solutions** - Device management, real-time communication
- **Debug Commands & Tools** - Redis, database, and Kubernetes commands
- **Performance Optimization** - Database, Redis, and application tuning
- **Monitoring & Alerting** - Key metrics and alerting rules
- **Load Testing** - Performance testing and benchmarking

---

## 🚀 Quick Start

### For New Developers
1. **Start with [System Architecture](./architecture/system/SYSTEM_ARCHITECTURE.md)** - Understand the overall design
2. **Read [Device Management](./architecture/device/DEVICE_MANAGEMENT.md)** - Learn the device lifecycle
3. **Check [Real-Time Communication](./architecture/real-time/REAL_TIME_COMMUNICATION.md)** - Understand SSE/WebSocket
4. **Bookmark [Troubleshooting](./TROUBLESHOOTING.md)** - For when you need help

### For System Administrators
1. **Focus on [System Architecture](./architecture/system/SYSTEM_ARCHITECTURE.md)** - Deployment and infrastructure
2. **Use [Troubleshooting](./TROUBLESHOOTING.md)** - Debug commands and monitoring
3. **Reference [Real-Time Communication](./architecture/real-time/REAL_TIME_COMMUNICATION.md)** - Pushpin and Redis setup

### For API Integration
1. **Start with [Device Management](./architecture/device/DEVICE_MANAGEMENT.md)** - Complete API reference
2. **Check [Real-Time Communication](./architecture/real-time/REAL_TIME_COMMUNICATION.md)** - SSE/WebSocket integration
3. **Use [Troubleshooting](./TROUBLESHOOTING.md)** - Debug commands and testing

---

## 📁 Supporting Documentation

### 🧪 [Testing](./testing/)
- **Load Testing Guide** - Comprehensive load testing strategies
- **Testing Documentation** - Testing patterns and best practices

### 📖 [Guides](./guides/)
- **Create Operations** - How to create resources
- **Update Operations** - How to update resources
- **CRUD Operations** - Create, Read, Update, Delete patterns
- **Listing Tables** - Data table implementation

### 🚀 [Deployment](./deployment/)
- **Deployment Guide** - Production deployment instructions
- **Configuration** - Environment and service configuration

### 📊 [Migrations](./migrations/)
- **Database Migrations** - Schema changes and data migrations
- **ClickHouse Migrations** - Analytics database migrations

### 📦 [Bundle Retry & Resume Issues](./BUNDLE_RETRY_RESUME_ISSUES.md)
- **Status reverts to FAILED on refresh** - Root cause and fixes (grace period, full install payload)
- **Retry/Resume with deleted resources** - Missing check; how to add validation
- **Implementation checklist** - Summary of required changes

---

## 📊 System Overview

The IoT Management System is designed for:

- **🚀 Scalability**: Handle 100k+ devices simultaneously
- **⚡ Real-time**: Live updates and status tracking via SSE/WebSocket
- **🏗️ Modularity**: Clean, maintainable architecture with separation of concerns
- **📈 Performance**: Batch processing and optimized database operations
- **🔒 Security**: Multi-layer authentication and authorization
- **🌐 Production Ready**: Kubernetes deployment with monitoring and alerting

---

## 🔄 Recent Updates

- **2025-01-12**: ✅ **Complete device flow documentation** - Added comprehensive Register → Listen → JWT flow with code examples
- **2025-01-12**: ✅ **Device SSE implementation** - Detailed device listen flow with API key authentication
- **2025-01-12**: ✅ **JWT token acquisition** - Complete JWT generation and usage flow for device APIs
- **2025-01-12**: ✅ **Code examples** - Go and Python device client implementations
- **2025-10-12**: ✅ **Complete documentation consolidation** - Reduced 50+ scattered files to 4 comprehensive documents
- **2025-10-12**: ✅ **Professional structure** - All documentation now includes file paths, code examples, and implementation details
- **2025-10-12**: ✅ **Visual flow diagrams** - Added ASCII diagrams for complex message flows
- **2025-10-12**: ✅ **Complete API reference** - All device endpoints with request/response examples
- **2025-10-12**: ✅ **Comprehensive troubleshooting** - All known issues, fixes, and debug commands
- **2025-10-12**: ✅ **Performance optimization** - Database, Redis, and application tuning guides

---

## 📝 Documentation Standards

- **✅ Last Updated**: Each document includes a "Last updated" timestamp
- **✅ Code Examples**: All code examples are tested and working
- **✅ File Paths**: Direct links to implementation files
- **✅ Visual Diagrams**: ASCII flow diagrams for complex processes
- **✅ Performance Metrics**: Real performance data and benchmarks
- **✅ Error Handling**: Comprehensive error scenarios and solutions
- **✅ Production Ready**: All documentation reflects production deployments

---

## 🤝 Contributing

When adding new documentation:

1. **Choose the appropriate main document** based on content type
2. **Follow the existing structure** and formatting
3. **Include file paths** and code examples
4. **Add visual diagrams** for complex flows
5. **Update this README** if adding new categories
6. **Test all examples** before documenting

---

## 🎯 Key Benefits

### Before Consolidation
- ❌ 50+ scattered documentation files
- ❌ Duplicate information across files
- ❌ Missing implementation details
- ❌ Hard to find relevant information
- ❌ Inconsistent formatting and structure

### After Consolidation
- ✅ **4 comprehensive documents** covering everything
- ✅ **No duplication** - Each topic covered once, thoroughly
- ✅ **Complete implementation details** with file paths and code
- ✅ **Easy navigation** - Logical structure and cross-references
- ✅ **Professional formatting** - Consistent structure and visual diagrams
- ✅ **Production ready** - All documentation reflects real deployments

---

*For specific questions or clarifications, please refer to the individual documentation files or contact the development team.*