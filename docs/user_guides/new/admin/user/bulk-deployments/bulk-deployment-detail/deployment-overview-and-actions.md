# Bulk Deployment Detail Overview and Actions

**Last Updated**: 2026-05-06  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

The **Deployment Details** page shows the saved configuration, deployment status, audit information, and action buttons for a selected bulk deployment. The **Devices** tab is selected by default when you open a deployment.

![Deployment detail overview and Devices tab](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/deployment-detail-overview-devices.png)

*Figure 1. Deployment Details page showing the overview card, action buttons, audit information, and default Devices tab.*

## Open a Deployment

1. Go to **Devices -> RDM Management -> Bulk Deployment**.
2. Find the deployment in the list.
3. Click the deployment name, or open the row **Actions** menu and choose **View**.
4. Confirm that the page title is **Deployment Details**.

## Deployment Overview

The overview card summarizes the deployment configuration:

- **Deployment Name**: Display name for the deployment.
- **Status**: Current state, such as Draft, Published, In Progress, Completed, Scheduled, Failed, Stopped, Cancelled, or Canceled.
- **Target OS**: Operating system targeted by the deployment.
- **Version**: Deployment version. This value is preserved after edit, duplicate, and publish actions.
- **Batch Size**: Number of target devices processed per batch.
- **Start On**: Scheduled start date and time. Empty or dash values indicate no future schedule.
- **End On**: End date and time when available.
- **Description**: Optional deployment notes.
- **Reboot Device**: Shows Enable or Disable.
- **Force Update**: Shows Enable or Disable.
- **Created by / Last updated by**: Audit information for the deployment.

## Tabs

Use the tabs below the overview to manage the deployment content and execution results:

- **Devices**: Add, search, import, and remove target devices.
- **Apps**: Add, search, and remove applications.
- **Batches**: Monitor generated deployment batches and status metrics.

## Edit a Deployment

Use **Edit** to change draft configuration such as name, description, version, batch size, schedule, reboot behavior, and force update behavior.

![Edit Deployment modal](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/edit-deployment-modal.png)

*Figure 2. Edit Deployment modal for updating draft configuration before publishing.*

1. Open the deployment detail page.
2. Click **Edit**.
3. Update the required fields.
4. Click **Save Changes**.
5. Confirm the overview reflects the updated values.

Use **Cancel** to close the modal without saving changes. Empty deployment names block saving.

## Publish a Deployment

Use **Publish** to move a draft out of Draft status.

1. Confirm the overview configuration is correct.
2. Confirm target devices and/or apps are assigned as needed.
3. Click **Publish**.
4. Confirm the publish action when prompted.
5. Watch the status badge for the updated state.

Current product behavior allows publishing with app and device assignments, device-only assignments, or app-only assignments. A future schedule changes the deployment status to **Scheduled** until the scheduled time.

## Duplicate a Deployment

Use **Duplicate** to create a new draft copy from an existing deployment.

![Duplicate Deployment confirmation dialog](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/duplicate-deployment-confirm.png)

*Figure 3. Duplicate confirmation dialog. Confirming creates a new draft copy and opens its detail page.*

1. Open the deployment detail page.
2. Click **Duplicate**.
3. Confirm the duplicate action.
4. The platform opens the new draft detail page.

Duplicated deployments copy overview fields, assigned apps, assigned devices, and version. The duplicated deployment name contains a copy indicator so it can be traced back to the source.

## Delete a Deployment

Use **Delete** only when you are sure the deployment should be removed.

![Delete Deployment confirmation dialog](/docs/user_guides/new/admin/user/bulk-deployments/bulk-deployment-detail/resources/delete-deployment-confirm.png)

*Figure 4. Delete confirmation dialog. Confirming removes the deployment when deletion is allowed.*

1. Open the deployment detail page or row action menu.
2. Click **Delete**.
3. Review the confirmation dialog.
4. Click **Delete** to remove the deployment, or **Cancel** to keep it.

Draft deployments can be deleted. After a non-scheduled deployment is published, Delete is hidden on detail. Scheduled deployments can still show Delete before they run.
