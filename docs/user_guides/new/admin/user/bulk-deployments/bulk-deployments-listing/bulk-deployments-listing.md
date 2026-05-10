# Bulk Deployments Listing Guide

**Last Updated**: 2026-05-06  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **Bulk Deployments** listing page is where you create, find, and manage deployment drafts before opening a deployment detail page. Use this page to review deployment status, search by name or ID, and run row-level actions such as View, Publish, Edit, Duplicate, and Delete.

![Bulk Deployments listing page](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployments-listing/resources/bulk-deployments-listing-page.png)

*Figure 1. Bulk Deployments listing page with search, Add Deployment, deployment table, status column, and row actions.*

## Navigation

- **Menu Path**: Devices -> RDM Management -> Bulk Deployment
- **URL**: `/user/iot/bundles`
- **Page Title**: Bulk Deployments

## Listing Page Layout

The page contains the following primary controls:

- **Search by Name or ID**: Filters deployments in the table.
- **Add Deployment**: Opens the create deployment modal.
- **Deployment table**: Displays deployments with key scheduling and status information.

The table includes these columns:

- **Deployment Name**: Click the deployment name to open the detail page.
- **Version**: Shows the deployment version, defaulting to `1.0.0` unless changed.
- **Start On**: Shows the scheduled start time when a future schedule is configured.
- **End On**: Shows the deployment end time when available.
- **Status**: Shows the current deployment state, such as Draft, Published, In Progress, Completed, Scheduled, Failed, Stopped, Cancelled, or Canceled.
- **Actions**: Opens row actions for the selected deployment.

## Search Deployments

Use the search box to filter deployments by name or ID.

![Search deployment result](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployments-listing/resources/search-deployment-result.png)

*Figure 2. Search result after filtering by deployment name. The matching draft appears in the deployment table.*

1. Open **Bulk Deployment** from the sidebar.
2. Click **Search by Name or ID**.
3. Enter a deployment name or deployment ID.
4. Review the filtered table results.
5. Clear the search box to return to the full list.

If the keyword does not match any deployment, the page shows the no-result state.

![Search no results](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployments-listing/resources/search-no-results.png)

*Figure 3. No-result state shown when the search keyword does not match any deployment.*

## Row Actions

Open the **Actions** menu from a deployment row to manage that deployment.

![Deployment row actions menu](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployments-listing/resources/deployment-row-actions-menu.png)

*Figure 4. Row Actions menu for a deployment, including View, Publish, Edit, Duplicate, and Delete options.*

Common row actions include:

- **View**: Opens the deployment detail page.
- **Publish**: Starts or schedules the deployment after confirmation.
- **Edit**: Opens the edit modal for draft configuration changes.
- **Duplicate**: Creates a new draft copy from the selected deployment.
- **Delete**: Deletes a deployment when the current status allows deletion.

## Create a Draft Deployment

Click **Add Deployment** to open the creation modal.

![Add Deployment modal](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployments-listing/resources/add-deployment-modal.png)

*Figure 5. Add Deployment modal with required fields, version, batch size, schedule, description, and behavior toggles.*

1. Click **Add Deployment**.
2. Enter **Deployment Name**. The maximum length is 50 characters.
3. Select **Target to Operating System**, such as Android.
4. Review or update **Version**. The default value is `1.0.0`.
5. Select **Batch Size**. Choose a preset value or use a custom batch size.
6. Select **Schedule**:
   - **None**: Creates a draft without a scheduled start date.
   - **Future**: Requires a future date and time.
7. Add an optional **Description**. The maximum length is 200 characters.
8. Configure deployment behavior:
   - **Reboot Device**: Reboots target devices after deployment when enabled.
   - **Force Update**: Forces update behavior when enabled.
9. Click **Save as Draft**.

After saving, the platform opens the new deployment detail page.

## Validation Notes

- **Deployment Name** is required.
- **Target to Operating System** is required.
- **Batch Size** is required.
- **Version** defaults to `1.0.0` if left blank.
- **Cancel** closes the modal without creating a deployment.
- Duplicate draft names are allowed, so use clear naming when multiple users manage deployments.
