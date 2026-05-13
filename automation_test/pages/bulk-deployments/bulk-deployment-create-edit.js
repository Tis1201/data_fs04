const { expect } = require('@playwright/test');
const { BULK_DEPLOYMENT } = require('../../constants/bulk-deployment.constants');

const T = BULK_DEPLOYMENT.UI_TEXT;

/** Add / Edit deployment modals and draft creation. */
const bulkDeploymentCreateEdit = {
  async setBatchSize(batchSize) {
    const value = String(batchSize);
    if (['100', '200', '300', '400', '500'].includes(value)) {
      await this.selectDropdown(T.FORM.BATCH_SIZE_LABEL, value);
      return;
    }

    await this.selectDropdown(T.FORM.BATCH_SIZE_LABEL, 'Custom');
    await this.inputByLabel(T.FORM.BATCH_SIZE_LABEL).fill(value);
  },

  async setFutureSchedule(date, time = '09:00') {
    await this.selectDropdown(T.FORM.SCHEDULE_LABEL, T.FORM.FUTURE);
    await this.getDateInput().fill(date);
    await this.getTimeInput().fill(time);
  },

  async setSwitch(label, enabled) {
    const switchButton = this.getSwitchByLabel(label);
    const checked = await switchButton.getAttribute('aria-checked');
    if ((checked === 'true') !== enabled) {
      await switchButton.click();
    }
  },

  async fillDeploymentForm(data) {
    if (data.name !== undefined) {
      await this.fillInput(T.FORM.NAME_LABEL, data.name);
    }
    if (data.targetOS !== undefined) {
      await this.selectDropdown(T.FORM.TARGET_OS_LABEL, data.targetOS);
    }
    if (data.version !== undefined) {
      await this.fillInput(T.FORM.VERSION_LABEL, data.version);
    }
    if (data.batchSize !== undefined) {
      await this.setBatchSize(data.batchSize);
    }
    if (data.schedule === T.FORM.FUTURE && data.scheduleDate) {
      await this.setFutureSchedule(data.scheduleDate, data.scheduleTime);
    } else if (data.schedule !== undefined) {
      await this.selectDropdown(T.FORM.SCHEDULE_LABEL, data.schedule);
    }
    if (data.description !== undefined) {
      await this.fillTextarea(T.FORM.DESCRIPTION_LABEL, data.description);
    }
    if (data.rebootDevice !== undefined) {
      await this.setSwitch(T.FORM.REBOOT_DEVICE, Boolean(data.rebootDevice));
    }
    if (data.forceUpdate !== undefined) {
      await this.setSwitch(T.FORM.FORCE_UPDATE, Boolean(data.forceUpdate));
    }
  },

  async saveAsDraftExpectDetail() {
    await expect(this.saveAsDraftButton).toBeEnabled({ timeout: this.timeout });
    await this.saveAsDraftButton.click();
    await expect(this.pageTitle).toBeVisible({ timeout: this.timeout });
    await expect(this.addDeploymentDialog).toBeHidden({ timeout: this.timeout }).catch(() => {});
    await this.waitForUiSettled();
    return this.getDeploymentIdFromUrl();
  },

  async saveAsDraftExpectBlocked() {
    await expect(this.saveAsDraftButton).toBeDisabled({ timeout: this.timeout });
    await expect(this.addDeploymentModalTitle.first()).toBeVisible({ timeout: this.timeout });
  },

  async createDraftDeployment(data) {
    await this.openAddDeploymentModal();
    await this.fillDeploymentForm(data);
    const id = await this.saveAsDraftExpectDetail();
    const created = { id, name: data.name };
    this.registerDeployment(created);
    return created;
  },

  async openEditDeploymentModal() {
    await expect(this.editButton.first()).toBeVisible({ timeout: this.timeout });
    await this.editButton.first().click();
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await expect(dialog).toBeVisible({ timeout: this.timeout });
    return dialog;
  },

  async fillEditDeploymentForm(data) {
    return this.fillDeploymentForm(data);
  },

  async saveEditExpectDetail() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    const saveButton = this.getSaveChangesButton(dialog);
    await expect(saveButton).toBeEnabled({ timeout: this.timeout });
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
    await this.waitForToastOrNetwork();
    return this.getDeploymentIdFromUrl();
  },

  async saveEditExpectBlocked() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await expect(this.getSaveChangesButton(dialog)).toBeDisabled({ timeout: this.timeout });
    await expect(dialog).toBeVisible({ timeout: this.timeout });
  },

  async cancelEdit() {
    const dialog = this.dialogByTitle(T.DIALOG_EDIT_DEPLOYMENT);
    await this.getCancelButton(dialog).click();
    await expect(dialog).toBeHidden({ timeout: this.timeout });
  },
};

module.exports = bulkDeploymentCreateEdit;
