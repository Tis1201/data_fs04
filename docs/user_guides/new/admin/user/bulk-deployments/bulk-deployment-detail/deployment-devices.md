# Bulk Deployment Devices Guide

**Last Updated**: 2026-05-06  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **Devices** tab controls which devices are targeted by the bulk deployment. It is the default tab on the Deployment Details page and supports direct device selection, CSV import, tag assignment, table search, and device removal.

![Deployment Devices tab](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/deployment-detail-overview-devices.png)

*Figure 1. Devices tab on the Deployment Details page, including Import CSV, Assign by tag, Add Device, search, and device table.*

## Devices Tab Layout

The Devices tab includes:

- **Import CSV**: Opens a CSV upload workflow for adding devices in bulk.
- **Assign by tag**: Adds devices that match a selected device tag.
- **Add Device**: Opens a searchable device picker.
- **Table search**: Filters devices already added to the deployment.
- **Devices table**: Shows device targeting and status details.

The devices table includes these columns:

- **#**: Row number.
- **Device**: Device name or identifier.
- **Operating System**: Device OS.
- **Model**: Device model.
- **Deployment Status**: Deployment-specific status for that device.
- **Status**: Current device connection status, such as Online or Offline.
- **Actions**: Row actions, including Remove when available.

## Add Devices Manually

Use **Add Device** when you want to search for and assign one or more devices directly.

![Add Device modal with search results](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/add-device-modal-search.png)

*Figure 2. Add Device modal with search results. Select devices here before clicking Add.*

1. Open the deployment detail page.
2. Click the **Devices** tab.
3. Click **Add Device**.
4. Search by device name, model, or MAC-related text.
5. Select one or more devices from the results.
6. Confirm the selected count.
7. Click **Add**.

The **Add** button remains disabled until at least one device is selected. If no devices match the search term, the modal shows a no-results state.

## Import Devices by CSV

Use **Import CSV** when you have a prepared list of devices.

![Import CSV modal](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/import-csv-modal.png)

*Figure 3. Import CSV modal with CSV Template and Upload File controls for bulk device assignment.*

1. Click **Import CSV** from the Devices tab.
2. Download or review the **CSV Template** if needed.
3. Upload the prepared CSV file.
4. Confirm the import action when the Import button becomes available.

The Import button stays disabled until a valid file is selected.

## Assign Devices by Tag

Use **Assign by tag** when devices are already organized with tags.

![Assign by tag modal](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/assign-by-tag-modal.png)

*Figure 4. Assign by tag modal. Search and select a tag to add matching devices to the deployment.*

1. Click **Assign by tag**.
2. Search for a tag.
3. Select the target tag.
4. Click **Add** to assign matching devices.

The Add button remains disabled until a tag is selected.

## Search Assigned Devices

Use the Devices tab table search to filter devices already assigned to the deployment.

1. Click the table search input.
2. Enter a device name, ID, model, or MAC-related keyword.
3. Review the matching rows.
4. Clear the search field to return to all assigned devices.

## Remove a Device

1. Find the device in the Devices table.
2. Open the row **Actions** menu.
3. Choose **Remove**.
4. Confirm the remove action.

Removing a device from a draft updates the Devices table immediately. Online and Offline devices can both be assigned, and their connection status is shown in the table.
