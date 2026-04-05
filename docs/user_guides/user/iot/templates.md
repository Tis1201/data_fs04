# Templates (Sensor templates)

**Last Updated**: 2025-03-27  
**Audience**: End Users  
**Complexity**: Beginner to Intermediate

## Overview

**Templates** are reusable **sensor templates** for your account. They come in two types: **Alert** and **Configuration**. Use them to standardize tracking areas, zones, device modes, and alert-related settings, then assign templates to sensors or mark one template as the **default** for quicker deployment.

## Prerequisites

- Access to the user portal  
- Your **account** context selected (templates are scoped to the current account)  

## Navigation

- **Menu**: **IoT Management** → **Templates**
- **List URL**: `/user/iot/templates`
- **Detail URL**: `/user/iot/templates/[id]`

In the app, the list page title is **Templates**, with the subtitle *Reusable configurations and alert rules*. Template detail shows **Template Details** — *Manage reusable sensor templates for quick deployment*.

## Template types

| Type | Typical use |
|------|-------------|
| **Alert** | Templates focused on alert rules and related configuration. |
| **Configuration** | Templates for layout and device-style settings (tracking area, zones, mode, timezone, path tracking, dwell threshold, etc.). |

Exact fields available in the editor depend on the template type and what your organization uses.

## List page

- **Search** — Find templates by name or description.
- **Sort** — e.g. by name, type, last updated, default flag (see column headers).
- **Pagination** — Navigate pages of templates.
- **Add Template** — Create a new **Alert** or **Configuration** template from the add flow.

### Row actions

- **Edit** — Opens the edit modal (or navigate to **Template Details** for full-page editing).
- **Duplicate** — Creates a copy of the template (useful for variations).
- **Set as default** — Marks the template as the account default where the product uses a default template.
- **Delete** — Removes the template (with confirmation).

## Template details (`/user/iot/templates/[id]`)

On the detail page you can:

- Review template metadata (name, type, default flag, assignment info).
- Edit **configuration**: tracking area, **zones** (with the visual editor where available), and device-related options.
- For alert templates, manage **alert** settings as exposed in the UI.
- See which **sensors** use the template, when applicable.

Save changes as prompted; the UI will confirm success or show validation errors.

## Assignments

Templates can be associated with **sensors** (assignment count appears on the list). When creating or editing sensors, your team can pick a template to apply baseline settings—follow the sensor and device modals in the product for the latest assignment UX.

## Related features

- **[Sensors](./sensors.md)** — Register radar devices and open sensor detail to apply or adjust settings.
- **[Data](./data.md)** — Analytics after templates and sensors are live.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Cannot delete template | Check if sensors still depend on it; reassign or clear assignments first if the UI requires it. |
| Default template not applied | Confirm **Set as default** completed successfully and that new flows respect the default in your product version. |

---

**Status**: Describes user-facing template list, detail, and actions as implemented in the app.
