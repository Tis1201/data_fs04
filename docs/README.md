# Documentation

This directory contains comprehensive documentation for the IoT Management System. The documentation is organized into logical categories for easy navigation and maintenance.

## 📁 Directory Structure

### 🏗️ [Architecture](./architecture/)
Core system architecture and design documents:
- **Scalable Event Processing** - High-performance event processing for 100k+ devices
- **Bundle Status Pipeline** - Real-time bundle installation status tracking
- **Device Status Redis** - State management and caching strategies
- **Device Data Flow** - Real-time device data flow with ClickHouse and PostgreSQL
- **PIN App Data** - Hierarchical pin management and rule engine
- **WebRTC Architecture** - Terminal and remote desktop WebRTC implementation

### 🚀 [Features](./features/)
Feature-specific documentation:
- **Device Management** - Device registration, claiming, and management
- **Device Claim** - Device claiming process and PIN validation
- **Pushpin** - Real-time messaging and WebSocket management

### 🔌 [API](./api/)
API documentation and authentication:
- **API Reference** - Complete API endpoint documentation
- **JWT Authentication** - JSON Web Token implementation and usage

### 📖 [Guides](./guides/)
User guides and implementation documentation:
- **Create Operations** - How to create resources and entities
- **Update Operations** - How to update and modify resources
- **CRUD Operations** - Create, Read, Update, Delete patterns
- **Listing Tables** - Data table implementation and features

### ⚡ [Performance](./performance/)
Performance optimization and monitoring:
- **TODOs** - Performance improvement tasks and optimizations

## 🚀 Quick Start

1. **New to the system?** Start with [Architecture](./architecture/) to understand the overall design
2. **Building features?** Check [Features](./features/) for specific implementations
3. **Integrating APIs?** See [API](./api/) for endpoint documentation
4. **Need help?** Browse [Guides](./guides/) for step-by-step instructions

## 📝 Documentation Standards

- **Last Updated**: Each document includes a "Last updated" timestamp
- **Code Examples**: All code examples are tested and working
- **Mermaid Diagrams**: Visual representations for complex flows
- **Performance Metrics**: Real performance data and benchmarks
- **Error Handling**: Comprehensive error scenarios and solutions

## 🔄 Recent Updates

- **2025-01-26**: Added modular architecture and batch processing documentation
- **2025-01-26**: Reorganized documentation into logical folders
- **2025-01-26**: Enhanced performance documentation with 500x speed improvements

## 🤝 Contributing

When adding new documentation:
1. Choose the appropriate folder based on content type
2. Follow the existing naming conventions
3. Include "Last updated" timestamps
4. Add cross-references to related documents
5. Update this README if adding new categories

## 📊 System Overview

The IoT Management System is designed for:
- **Scalability**: Handle 100k+ devices simultaneously
- **Real-time**: Live updates and status tracking
- **Modularity**: Clean, maintainable architecture
- **Performance**: Batch processing and optimized database operations
- **Security**: Comprehensive authentication and authorization

---

*For specific questions or clarifications, please refer to the individual documentation files or contact the development team.*
