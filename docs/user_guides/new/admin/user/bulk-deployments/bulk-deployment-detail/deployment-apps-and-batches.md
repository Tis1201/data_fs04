# Bulk Deployment Apps and Batches Guide

**Last Updated**: 2026-05-06  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **Apps** tab defines which applications are included in a deployment. The **Batches** tab shows deployment batch metrics and generated batch records after publishing.

## Apps Tab

Open the **Apps** tab from the Deployment Details page to review or assign applications.

![Deployment Apps tab empty state](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/deployment-apps-tab-empty.png)

*Figure 1. Apps tab empty state before any applications are assigned to the deployment.*

The Apps tab includes:

- **Add App**: Opens a searchable app picker.
- **Apps table**: Shows applications assigned to the deployment.
- **Empty state**: Shows when no apps have been added yet.

The apps table includes these columns:

- **App**: Application name.
- **Type**: Application type.
- **Version**: Application version.
- **Size**: App package size.
- **Auto Open**: Whether the app auto-opens after deployment.
- **Added On**: Date the app was added to the deployment.
- **Actions**: Row actions, including Remove when available.

## Add Apps

Use **Add App** to assign one or more applications.

![Add App modal with search results](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/add-app-modal-search.png)

*Figure 2. Add App modal with search results. Select one or more apps before clicking Assign.*

1. Open the deployment detail page.
2. Click the **Apps** tab.
3. Click **Add App**.
4. Search for an app by name.
5. Select one or more app results.
6. Confirm the selected count.
7. Click **Assign**.

The Assign button remains disabled until at least one app is selected. If no apps match your search, the modal shows a no-results state and Assign remains disabled.

## Remove an App

1. Open the **Apps** tab.
2. Find the app in the table.
3. Open the row **Actions** menu.
4. Choose **Remove**.
5. Confirm the remove action.

Re-adding the same app to a draft should keep a single app row instead of creating duplicates.

## Batches Tab

Open the **Batches** tab to review deployment execution batches.

![Deployment Batches tab empty state](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/deployment-batches-tab-empty.png)

*Figure 3. Batches tab for a draft deployment, showing zero metrics and the No Data Available state.*

The Batches tab shows metric cards for:

- **Total Batches**
- **Batches Completed**
- **Batches In-Progress**
- **Batches Failed**
- **Batches Canceled**

For draft deployments, the batch metrics are usually `0` and the table shows **No Data Available.** Batches are generated after a deployment is published, depending on schedule and deployment execution.

When batches exist, the batch table can include:

- **#**
- **Batch Name**
- **Devices**
- **Status**
- **Started On**
- **End On**

## How to Use Batch Metrics

1. Publish or schedule the deployment.
2. Open the **Batches** tab.
3. Review the metric cards to understand progress.
4. Check the batch table for individual batch status.
5. Use failed or canceled counts to identify batches that need follow-up.

For future scheduled deployments, batch counts may remain zero until the scheduled start time. For offline device deployments, metrics remain numeric and non-negative so you can still monitor the deployment state.
