# User Guides

**Last Updated**: 2025-10-12  
**Status**: 📚 User Documentation

Welcome to the IoT Management System User Guides! These guides provide step-by-step instructions for using every feature in the system.

---

## 🎯 Quick Start

### For New Users
1. **Start with [Device Management](./admin/devices.md)** - Learn how to manage devices
2. **Read [Bundle Management](./admin/bundles.md)** - Understand bundle deployment
3. **Check [Device Profiles](./admin/device_profiles.md)** - Configure device settings
4. **Explore [PIN Rules](./admin/pin_rules.md)** - Set up PIN management
5. **Use [Device Tags](./admin/device_tags.md)** - Organize your devices

### For Administrators
- **Admin Guides** - Complete administrative features
- **User Management** - Account and permission management
- **System Configuration** - Settings and integrations
- **Monitoring & Debug** - System monitoring and troubleshooting

### For End Users
- **User Guides** - User-specific features and workflows
- **Device Operations** - Basic device management
- **Resource Access** - File and resource management
- **Analytics** - Logs and reporting

---

## 📁 Guide Categories

### 🔧 [Admin Guides](./admin/)
Complete administrative features and system management:

#### Core Features
- **[Device Management](./admin/devices.md)** - Complete device lifecycle management
- **[Bundle Management](./admin/bundles.md)** - Bundle creation, deployment, and monitoring
- **[Device Profiles](./admin/device_profiles.md)** - Device configuration and settings
- **[PIN Rules](./admin/pin_rules.md)** - PIN rule configuration and hierarchy
- **[Device Tags](./admin/device_tags.md)** - Device organization and tagging

#### System Management
- **[Factory Tokens](./admin/factory_tokens.md)** - Factory token management
- **[Preclaims](./admin/preclaims.md)** - Preclaim set management
- **[Resources](./admin/resources.md)** - Resource upload and management
- **[Accounts](./admin/accounts.md)** - Account management
- **[Companies](./admin/companies.md)** - Company management
- **[Users](./admin/users.md)** - User management
- **[Groups](./admin/groups.md)** - Group management

#### Integrations & Settings
- **[Webhooks](./admin/webhooks.md)** - Webhook configuration
- **[WhatsApp](./admin/whatsapp.md)** - WhatsApp integration
- **[Listeners](./admin/listeners.md)** - Listener configuration
- **[General Settings](./admin/general_settings.md)** - General system settings
- **[Email Settings](./admin/email_settings.md)** - Email configuration

#### Security & Authentication
- **[Signing Keys](./admin/signing_keys.md)** - JWT signing key management
- **[API Keys](./admin/api_keys.md)** - API key management
- **[Refresh Tokens](./admin/refresh_tokens.md)** - Refresh token management
- **[Token Logs](./admin/token_logs.md)** - Token usage logs

#### Vision & Monitoring
- **[Streams](./admin/streams.md)** - Vision stream management
- **[Preview](./admin/preview.md)** - Vision preview
- **[Monitor](./admin/monitor.md)** - System monitoring
- **[SSE Debug](./admin/sse_debug.md)** - SSE debugging
- **[Messaging Debug](./admin/messaging_debug.md)** - Messaging debugging
- **[Redis Debug](./admin/redis_debug.md)** - Redis debugging

### 👤 [User Guides](./user/)
User-specific features and workflows:

#### Dashboard & Overview
- **[Dashboard](./user/dashboard.md)** - Main user dashboard and overview
- **[Profile](./user/settings/profile.md)** - User profile management

#### IoT Device Management
- **[Device Management](./user/iot/devices.md)** - Device monitoring and basic operations
- **[Bundle Management](./user/iot/bundles.md)** - Bundle monitoring and installation tracking
- **[Device Profiles](./user/iot/device_profiles.md)** - Device profile monitoring
- **[PIN Rules](./user/iot/pin_rules.md)** - PIN rule monitoring and basic configuration
- **[Device Tags](./user/iot/device_tags.md)** - Device tagging and filtering
- **[Preclaims](./user/iot/preclaims.md)** - Preclaim monitoring and management

#### Integrations & Resources
- **[WhatsApp](./user/integrations/whatsapp.md)** - WhatsApp integration usage
- **[Resources](./user/resources/resources.md)** - Resource access and management
- **[Logs](./user/analytics/logs.md)** - Analytics and log viewing

#### Settings & Administration
- **[Account Settings](./user/settings/account.md)** - Account configuration
- **[User Management](./user/settings/users.md)** - User management (user view)

### 🤝 [Shared Features](./shared/)
Features that work the same across admin and user interfaces:

#### Device Operations
- **[Device Registration](./shared/device_registration.md)** - Device registration process
- **[Device Claiming](./shared/device_claiming.md)** - Device claiming workflow
- **[Bundle Installation](./shared/bundle_installation.md)** - Bundle installation workflow

#### Device Configuration
- **[Device Profiles](./shared/device_profiles.md)** - Device profile concepts
- **[PIN Rules](./shared/pin_rules.md)** - PIN rules concepts
- **[Device Tags](./shared/device_tags.md)** - Device tagging concepts

#### Real-Time Features
- **[Real-Time Communication](./shared/real_time_communication.md)** - SSE/WebSocket usage
- **[WebRTC Terminal](./shared/webrtc_terminal.md)** - WebRTC terminal usage
- **[WebRTC Remote Desktop](./shared/webrtc_remote_desktop.md)** - WebRTC remote desktop

#### Troubleshooting
- **[Troubleshooting](./shared/troubleshooting.md)** - Common user issues

---

## 🚀 Getting Started

### 1. Choose Your Role
- **Administrator** - Full system access and management
- **User** - Device monitoring and basic operations
- **Both** - Check shared features for common workflows

### 2. Start with Core Features
1. **Device Management** - Learn how to manage devices
2. **Bundle Management** - Understand bundle deployment
3. **Device Profiles** - Configure device settings
4. **PIN Rules** - Set up PIN management
5. **Device Tags** - Organize your devices

### 3. Explore Advanced Features
- **Integrations** - Set up webhooks and WhatsApp
- **Security** - Manage API keys and tokens
- **Monitoring** - Monitor system health and performance

---

## 📋 Feature Status

### ✅ Available Now
- Device Management
- Bundle Management
- Device Profiles
- PIN Rules
- Device Tags

### 🔄 Coming Soon
- Preclaims
- Resources
- Factory Tokens
- Account Management
- Integrations
- Security Features
- Vision Features
- Monitoring & Debug

---

## 🎯 Common Workflows

### Device Setup Workflow
1. **[Device Registration](./shared/device_registration.md)** - Register new device
2. **[Device Claiming](./shared/device_claiming.md)** - Claim device with PIN
3. **[Device Profiles](./admin/device_profiles.md)** - Assign profile to device
4. **[Device Tags](./admin/device_tags.md)** - Tag device for organization

### Bundle Deployment Workflow
1. **[Bundle Management](./admin/bundles.md)** - Create bundle
2. **[Resources](./admin/resources.md)** - Add apps to bundle
3. **[Bundle Installation](./shared/bundle_installation.md)** - Deploy to devices
4. **[Device Management](./admin/devices.md)** - Monitor installation

### PIN Management Workflow
1. **[PIN Rules](./admin/pin_rules.md)** - Configure PIN rules
2. **[Device Profiles](./admin/device_profiles.md)** - Apply rules to profiles
3. **[Device Management](./admin/devices.md)** - Monitor PIN usage

---

## 🔍 Finding Help

### Quick Help
- **Search** - Use Ctrl+F to search within guides
- **Navigation** - Use the sidebar to browse features
- **Cross-References** - Follow links to related features

### Detailed Help
- **Troubleshooting** - Check [Shared Troubleshooting](./shared/troubleshooting.md)
- **System Documentation** - See main [System Architecture](../SYSTEM_ARCHITECTURE.md)
- **API Reference** - Check [Device Management](../DEVICE_MANAGEMENT.md)

### Support
- **Contact Support** - Use the support system in the application
- **Documentation Issues** - Report documentation problems
- **Feature Requests** - Suggest new features or improvements

---

## 📝 Guide Standards

### Content Quality
- ✅ **Step-by-step instructions** - Clear, actionable steps
- ✅ **Screenshots** - Visual guides where helpful
- ✅ **Examples** - Real-world use cases
- ✅ **Troubleshooting** - Common issues and solutions
- ✅ **Best Practices** - Recommended approaches

### User Experience
- ✅ **Easy Navigation** - Clear structure and cross-references
- ✅ **Appropriate Level** - Content matches user role and experience
- ✅ **Consistent Format** - Standardized structure across all guides
- ✅ **Up-to-Date** - Regular updates with system changes

---

## 🔄 Recent Updates

- **2025-10-12**: ✅ **Phase 1 Core Features** - Device Management, Bundle Management, Device Profiles, PIN Rules, Device Tags
- **2025-10-12**: ✅ **Folder Structure** - Organized admin, user, and shared guides
- **2025-10-12**: ✅ **Navigation System** - Easy browsing and cross-references

---

**Status**: 📚 User guides are being created to help you use every feature effectively. Start with the core features and explore from there!
