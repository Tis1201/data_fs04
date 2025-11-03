# Companies User Guide

**Last Updated**: 2025-10-24  
**Audience**: Admin  
**Complexity**: Intermediate

## Overview

Companies represent organizations in the IoT Management System. They provide a way to group and manage related accounts, users, and devices. Companies are typically used for organizations that need to manage multiple accounts or have specific organizational requirements.

## Prerequisites

- **Admin permissions** - Full company management access
- **Organization understanding** - Knowledge of organizational structure
- **Account management** - Understanding of account relationships

## Getting Started

### Quick Start
1. **Navigate to Companies** - Go to Admin → Accounts → Companies
2. **Create New Company** - Click "Add Company" button
3. **Configure Company** - Set company name, address, and contact details
4. **Set Status** - Configure company status (Active/Inactive)
5. **Add to Account** - Associate company with an account
6. **Manage Relationships** - Add users and devices to company

### Navigation
- **Menu Path**: Admin → Accounts → Companies
- **URL**: `/admin/accounts/companies`
- **Direct Access**: Click "Companies" in the Accounts section

## Core Functionality

### Company List View

#### Company Information Display
- **Company Name** - Human-readable company name with clickable link
- **Company ID** - Unique system identifier (displayed with name)
- **Status** - Active/Inactive with color-coded badges
- **Address** - Company physical address
- **Contact Email** - Company contact email address
- **Devices Count** - Number of devices associated with company
- **Created Date** - When company was created (relative format)

#### Company Status Indicators
- 🟢 **Active** - Company is active and operational
- 🔴 **Inactive** - Company is disabled
- 🟡 **Pending** - Company is temporarily pending

#### Filtering and Search
- **Search by Name, ID, or Contact Email** - Find companies by multiple criteria
- **Filter by Status** - Show only active/inactive/pending companies
- **Sort Options** - Sort by name, status, created date
- **Pagination** - Navigate through multiple pages of companies

### Company Detail View

#### Company Information Section
- **Basic Info** - Name, status, address, contact details
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Toggle between Active/Inactive
- **Contact Information** - Address, email, phone number
- **Form Fields** - Name, address, contact email, contact phone, description

#### Relationship Management Sections

##### Users Section
- **Company Users** - Users associated with this company
- **Add Users** - Add existing users to company
- **Remove Users** - Remove users from company
- **User Management** - Manage user access to company

##### Account Association
- **Associated Account** - Account this company belongs to
- **Account Management** - Manage account relationship
- **Account Access** - Control account access permissions

## Advanced Features

### Company Creation

#### Basic Company Setup
- **Company Name** - Choose descriptive name (required)
- **Address** - Company physical address
- **Contact Email** - Company contact email address
- **Contact Phone** - Company contact phone number
- **Description** - Add detailed description (optional)
- **Status** - Set initial company status (Active/Inactive)

#### Company Configuration
- **Form Validation** - Real-time validation with error messages
- **Status Management** - Easy toggle between Active/Inactive states
- **Contact Information** - Complete contact details management
- **Account Association** - Link company to specific account

#### Company Actions
- **Edit Company** - Modify company details
- **Activate/Deactivate** - Toggle company status
- **Delete Company** - Remove company (with confirmation)
- **Manage Relationships** - Add/remove users, manage account association

### Company Management Features

#### Quick Actions
- **Edit Company** - Click company name or edit button
- **Toggle Status** - Activate/deactivate company
- **Delete Company** - Remove company with confirmation
- **View Details** - Access full company management

#### Bulk Operations
- **Status Filtering** - Filter by Active/Inactive/Pending status
- **Search** - Find companies by name, ID, or contact email
- **Sorting** - Sort by name, status, or creation date
- **Pagination** - Navigate through large company lists

## Common Workflows

### Workflow 1: Create New Company
1. **Navigate to Companies** - Go to Admin → Accounts → Companies
2. **Click "Add Company"** - Start company creation process
3. **Enter Company Details** - Fill in name, address, contact information
4. **Set Status** - Choose Active or Inactive status
5. **Associate Account** - Link company to an account
6. **Save Company** - Create the company record
7. **Add Users** - Add users to the company

### Workflow 2: Edit Existing Company
1. **Find Company** - Use search or filters to locate company
2. **Click Company Name** - Open company detail view
3. **Edit Information** - Modify name, address, contact details, or status
4. **Save Changes** - Confirm changes with save button
5. **Manage Relationships** - Add/remove users, update account association

### Workflow 3: Company Status Management
1. **Select Company** - Choose company from list
2. **Toggle Status** - Click activate/deactivate action
3. **Confirm Action** - Confirm status change in dialog
4. **Verify Change** - Check status badge reflects change
5. **Update Relationships** - Adjust user access as needed

### Workflow 4: Company Relationship Management
1. **Open Company** - Click company name to view details
2. **Navigate to Users** - Go to Users section
3. **Add Users** - Add existing users to company
4. **Remove Users** - Remove users from company
5. **Verify Changes** - Confirm relationships are updated

## Real-World Example

### **Example Company: "Acme Corporation"**
- **Company Name**: Acme Corporation
- **Address**: 123 Main St, City, State 12345
- **Contact Email**: contact@acme.com
- **Contact Phone**: (555) 123-4567
- **Status**: Active
- **Associated Account**: Enterprise Account
- **Users**: 15 company users

### **Company Setup Process**
1. **Create Company** - Enter "Acme Corporation" as name
2. **Add Address** - Enter physical address
3. **Set Contact Info** - Add email and phone
4. **Set Status** - Mark as Active
5. **Associate Account** - Link to Enterprise Account
6. **Add Users** - Add company users
7. **Verify Setup** - Confirm all information is correct

## Troubleshooting

### Common Issues

#### Company Creation/Editing Issues
- **Form Validation Errors** - Check required fields and format
- **Contact Information** - Ensure email and phone formats are valid
- **Status Changes** - Verify company status can be toggled
- **Account Association** - Check if account exists and is available
- **Permission Errors** - Ensure admin permissions are available

#### Search and Filtering Issues
- **Search Not Working** - Check search terms and try different keywords
- **Filter Not Applied** - Verify filter selections are correct
- **Results Not Loading** - Check pagination and refresh page
- **Sort Order** - Verify sort field and direction

#### Relationship Management Issues
- **Cannot Add Users** - Check if users exist and have proper permissions
- **Cannot Remove Users** - Check if users are required for company
- **Account Association Errors** - Verify account exists and is available
- **Relationship Errors** - Verify all required fields are filled

### Error Messages

#### "Company Not Found"
- **Cause**: Company ID doesn't exist in system
- **Solution**: Verify company ID and check company list

#### "Validation Error"
- **Cause**: Form data doesn't meet requirements
- **Solution**: Check required fields and data format

#### "Permission Denied"
- **Cause**: Insufficient permissions for action
- **Solution**: Verify admin role and permissions

#### "Relationship Error"
- **Cause**: Cannot establish or remove relationship
- **Solution**: Check if related items exist and are available

## Best Practices

### Company Design
- **Descriptive Names** - Use clear, descriptive company names
- **Complete Contact Info** - Provide complete address and contact details
- **Proper Status** - Use Active/Inactive status appropriately
- **Clear Descriptions** - Add helpful descriptions for company purpose
- **Regular Review** - Review companies regularly for accuracy

### Relationship Management
- **Logical Grouping** - Group users logically within companies
- **Appropriate Access** - Only add necessary users to companies
- **Regular Cleanup** - Remove outdated relationships
- **Account Association** - Ensure proper account relationships
- **Access Monitoring** - Monitor relationship changes

### Form Management
- **Save Frequently** - Save changes to avoid data loss
- **Validate Data** - Check form validation messages
- **Review Changes** - Review changes before saving
- **Test Status Changes** - Verify status changes work correctly
- **Backup Data** - Keep backups of important company data

### Security
- **Access Control** - Control company access strictly
- **Audit Logging** - Log all company operations
- **Permission Management** - Manage user permissions carefully
- **Status Monitoring** - Monitor company status changes
- **Data Protection** - Protect sensitive company information

## Technical Details

### Company Data Structure
- **ID** - Unique system identifier
- **Name** - Human-readable company name
- **Address** - Company physical address
- **Contact Email** - Company contact email address
- **Contact Phone** - Company contact phone number
- **Description** - Optional company description
- **Status** - Active/Inactive state
- **Created At** - Company creation timestamp
- **Updated At** - Last modification timestamp

### Search and Filtering
- **Search Fields** - Name, ID, and contact email
- **Filter Options** - Status (Active/Inactive/Pending)
- **Sort Options** - Name, status, created date
- **Pagination** - Configurable page size and navigation

### Relationship Management
- **Users** - Many-to-many relationship with users
- **Account** - Many-to-one relationship with account
- **Devices** - Indirect relationship through account

## Related Features

- **[Accounts](./accounts.md)** - Manage accounts that companies belong to
- **[Users](./users.md)** - Manage users associated with companies
- **[Device Management](./devices.md)** - Manage devices through company relationships

## Support

### Getting Help
- **Documentation** - Check related feature guides
- **Form Validation** - Review validation messages for guidance
- **UI Feedback** - Use built-in success/error messages
- **Admin Support** - Contact admin team for complex issues

### Common Solutions
- **Form Issues** - Check required fields and validation messages
- **Search Problems** - Try different search terms or clear filters
- **Relationship Errors** - Verify items exist before adding/removing
- **Status Changes** - Confirm changes in the dialog before proceeding

---

**Status**: ✅ Updated - This guide now accurately reflects the current company management UI and functionality.
