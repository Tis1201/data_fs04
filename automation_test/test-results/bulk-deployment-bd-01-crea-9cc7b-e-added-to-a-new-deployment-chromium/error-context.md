# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bulk-deployment\bd-01-create.test.js >> Bulk Deployment - Create - Extended Coverage >> TC-BULK-CREATE-026: Offline device can be added to a new deployment
- Location: tests\bulk-deployment\bd-01-create.test.js:462:3

# Error details

```
Error: Required Bulk Deployment device test data was not found in Add Device modal. Expected device="". Searched="". Results="No devices found". Check the DEV account/device assignment or the BULK_DEVICE_* environment variables.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - img "Data Realities" [ref=e7]
        - button "Collapse sidebar" [ref=e9] [cursor=pointer]:
          - img [ref=e10]
      - navigation [ref=e12]:
        - list [ref=e13]:
          - listitem [ref=e14]:
            - link "Dashboard" [ref=e15] [cursor=pointer]:
              - /url: /user/dashboard
              - img [ref=e17]
              - generic [ref=e22]: Dashboard
          - listitem [ref=e23]:
            - button "Devices" [ref=e24] [cursor=pointer]:
              - img [ref=e26]
              - generic [ref=e29]: Devices
              - img [ref=e31]
          - listitem [ref=e33]
          - listitem [ref=e35]:
            - button "RDM Management" [ref=e36] [cursor=pointer]:
              - img [ref=e38]
              - generic [ref=e41]: RDM Management
              - img [ref=e43]
            - list [ref=e45]:
              - listitem [ref=e46]:
                - link "Devices" [ref=e47] [cursor=pointer]:
                  - /url: /user/iot/devices?page=1&per_page=10&sort=name&order=asc
                  - generic [ref=e48]: Devices
              - listitem [ref=e49]:
                - link "Bulk Deployment" [ref=e50] [cursor=pointer]:
                  - /url: /user/iot/bundles
                  - generic [ref=e51]: Bulk Deployment
              - listitem [ref=e52]:
                - link "Application & Resources" [ref=e53] [cursor=pointer]:
                  - /url: /user/resources
                  - generic [ref=e54]: Application & Resources
              - listitem [ref=e55]:
                - link "Pre-Enrollment" [ref=e56] [cursor=pointer]:
                  - /url: /user/iot/preclaims
                  - generic [ref=e57]: Pre-Enrollment
              - listitem [ref=e58]:
                - link "App Pinning Rules" [ref=e59] [cursor=pointer]:
                  - /url: /user/iot/pin-rules
                  - generic [ref=e60]: App Pinning Rules
              - listitem [ref=e61]:
                - link "Profiles" [ref=e62] [cursor=pointer]:
                  - /url: /user/iot/device-profiles
                  - generic [ref=e63]: Profiles
          - listitem [ref=e64]:
            - button "IoT Management" [ref=e65] [cursor=pointer]:
              - img [ref=e67]
              - generic [ref=e73]: IoT Management
              - img [ref=e75]
          - listitem [ref=e77]:
            - button "Developers" [ref=e78] [cursor=pointer]:
              - img [ref=e80]
              - generic [ref=e84]: Developers
              - img [ref=e86]
          - listitem [ref=e88]:
            - button "Settings" [ref=e89] [cursor=pointer]:
              - img [ref=e91]
              - generic [ref=e94]: Settings
              - img [ref=e96]
    - generic [ref=e98]:
      - banner [ref=e100]:
        - generic [ref=e101]:
          - heading "Deployment Details" [level=1] [ref=e102]
          - paragraph [ref=e103]: View deployment status and performance
        - button "User menu" [ref=e105] [cursor=pointer]:
          - generic [ref=e108]: VU
          - generic [ref=e109]:
            - generic [ref=e110]: vu@gmail.com
            - generic [ref=e111]: USER
          - img [ref=e112]
      - main [ref=e114]:
        - generic [ref=e115]:
          - generic [ref=e117]:
            - button "Edit" [ref=e118] [cursor=pointer]:
              - img [ref=e119]
              - generic [ref=e122]: Edit
            - button "Publish" [ref=e123] [cursor=pointer]:
              - img [ref=e124]
              - generic [ref=e126]: Publish
            - button "Duplicate" [ref=e127] [cursor=pointer]:
              - img [ref=e128]
              - generic [ref=e131]: Duplicate
            - button "Delete" [ref=e132] [cursor=pointer]:
              - img [ref=e133]
              - generic [ref=e136]: Delete
          - generic [ref=e137]:
            - generic [ref=e138]:
              - generic [ref=e140]:
                - img [ref=e142]
                - generic [ref=e144]:
                  - heading "Deployment Overview" [level=3] [ref=e145]
                  - paragraph [ref=e146]: Key information about this deployment
              - generic [ref=e148]:
                - generic [ref=e149]:
                  - paragraph [ref=e150]: Deployment Name
                  - paragraph [ref=e151]: Bulk Auto cr-offline-1777358571093-652
                - generic [ref=e152]:
                  - paragraph [ref=e153]: Status
                  - generic [ref=e157] [cursor=pointer]: Draft
                - generic [ref=e158]:
                  - paragraph [ref=e159]: Target OS
                  - paragraph [ref=e160]: Android
                - generic [ref=e161]:
                  - paragraph [ref=e162]: Version
                  - paragraph [ref=e163]: 1.0.0
                - generic [ref=e164]:
                  - paragraph [ref=e165]: Batch Size
                  - paragraph [ref=e166]: "100"
                - generic [ref=e167]:
                  - paragraph [ref=e168]: Start On
                  - paragraph [ref=e169]: —
                - generic [ref=e170]:
                  - paragraph [ref=e171]: End On
                  - paragraph [ref=e172]: —
                - generic [ref=e174]:
                  - paragraph [ref=e175]: Description
                  - paragraph [ref=e176]: —
                - generic [ref=e177]:
                  - paragraph [ref=e178]: Reboot Device
                  - paragraph [ref=e179]: Disable
                - generic [ref=e180]:
                  - paragraph [ref=e181]: Force Update
                  - paragraph [ref=e182]: Disable
                - generic [ref=e186]:
                  - paragraph [ref=e187]: Created by Hoai Vu at Apr 27, 2026, 11:42 PM
                  - paragraph [ref=e188]: Last updated by Hoai Vu at Apr 27, 2026, 11:42 PM
            - generic [ref=e189]:
              - tablist [ref=e190]:
                - button "Devices" [ref=e191] [cursor=pointer]:
                  - generic [ref=e192]: Devices
                - button "Apps" [ref=e193] [cursor=pointer]:
                  - generic [ref=e194]: Apps
                - button "Batches" [ref=e195] [cursor=pointer]:
                  - generic [ref=e196]: Batches
              - generic [ref=e198]:
                - generic [ref=e200]:
                  - generic [ref=e201]:
                    - img [ref=e203]
                    - generic [ref=e206]:
                      - heading "Deployment Device" [level=3] [ref=e207]
                      - paragraph [ref=e208]: Devices targeted by this deployment
                  - generic [ref=e209]:
                    - button "Import CSV" [ref=e210] [cursor=pointer]:
                      - img [ref=e211]
                      - generic [ref=e214]: Import CSV
                    - button "Assign by tag" [ref=e215] [cursor=pointer]:
                      - img [ref=e216]
                      - generic [ref=e219]: Assign by tag
                    - button "Add Device" [active] [ref=e220] [cursor=pointer]:
                      - img [ref=e221]
                      - generic [ref=e222]: Add Device
                - generic [ref=e224]:
                  - searchbox "Search by device name or ID..." [ref=e228]
                  - table [ref=e231]:
                    - rowgroup [ref=e240]:
                      - row "# Device Operating System Model Deployment Status Status Actions" [ref=e241]:
                        - columnheader "#" [ref=e242]:
                          - generic [ref=e244]: "#"
                        - columnheader "Device" [ref=e245] [cursor=pointer]:
                          - generic [ref=e247]: Device
                        - columnheader "Operating System" [ref=e248] [cursor=pointer]:
                          - generic [ref=e250]: Operating System
                        - columnheader "Model" [ref=e251] [cursor=pointer]:
                          - generic [ref=e253]: Model
                        - columnheader "Deployment Status" [ref=e254] [cursor=pointer]:
                          - generic [ref=e256]: Deployment Status
                        - columnheader "Status" [ref=e257] [cursor=pointer]:
                          - generic [ref=e259]: Status
                        - columnheader "Actions" [ref=e260]:
                          - generic [ref=e262]: Actions
                    - rowgroup [ref=e263]:
                      - row "No devices added to this bundle yet" [ref=e264]:
                        - cell "No devices added to this bundle yet" [ref=e265]:
                          - generic [ref=e266]:
                            - img [ref=e267]
                            - generic [ref=e269]: No devices added to this bundle yet
    - region "Notifications" [ref=e270]:
      - alert [ref=e271]:
        - generic [ref=e272]:
          - img [ref=e274]
          - generic [ref=e278]: Deployment created successfully.
          - button "Dismiss alert" [ref=e279] [cursor=pointer]:
            - img [ref=e280]
  - generic [ref=e283]: untitled page
```

# Test source

```ts
  718 |   async deleteFromDetail(confirm = true) {
  719 |     await expect(this.deleteButton.first()).toBeVisible({ timeout: this.timeout });
  720 |     await this.deleteButton.first().click();
  721 |     const dialog = this.dialogByTitle(T.DIALOG_DELETE_DEPLOYMENT);
  722 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  723 |     if (!confirm) {
  724 |       await dialog.getByRole('button', { name: T.CANCEL }).click();
  725 |       await expect(dialog).toBeHidden({ timeout: this.timeout });
  726 |       return;
  727 |     }
  728 |     const navigationPromise = this.page
  729 |       .waitForURL((url) => url.pathname === this.listPath, { timeout: this.timeout })
  730 |       .catch(() => null);
  731 |     await dialog.getByRole('button', { name: T.DELETE }).click();
  732 |     await navigationPromise;
  733 |     await this.waitForListReady();
  734 |   }
  735 | 
  736 |   async deleteFromListByName(name, confirm = true) {
  737 |     await this.gotoList();
  738 |     await this.waitForListReady();
  739 |     await this.searchDeployment(name);
  740 |     await this.selectRowAction(name, T.ROW_ACTION_DELETE);
  741 |     const dialog = this.dialogByTitle(T.DIALOG_DELETE_DEPLOYMENT);
  742 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  743 |     if (!confirm) {
  744 |       await dialog.getByRole('button', { name: T.CANCEL }).click();
  745 |       await expect(dialog).toBeHidden({ timeout: this.timeout });
  746 |       return;
  747 |     }
  748 |     await dialog.getByRole('button', { name: T.DELETE }).click();
  749 |     await this.waitForToastOrNetwork();
  750 |   }
  751 | 
  752 |   async openImportCsvModal() {
  753 |     await this.openDevicesTab();
  754 |     await this.importCsvButton.click();
  755 |     const dialog = this.dialogByTitle(T.DIALOG_IMPORT_CSV);
  756 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  757 |     return dialog;
  758 |   }
  759 | 
  760 |   async openAssignByTagModal() {
  761 |     await this.openDevicesTab();
  762 |     await this.assignByTagButton.click();
  763 |     const dialog = this.dialogByTitle(T.DIALOG_ASSIGN_BY_TAG);
  764 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  765 |     return dialog;
  766 |   }
  767 | 
  768 |   async openAddDeviceModal() {
  769 |     await this.openDevicesTab();
  770 |     await this.addDeviceButton.click();
  771 |     const dialog = this.dialogByTitle(T.DIALOG_ADD_DEVICE);
  772 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  773 |     await expect(this.getAddDeviceSearchInput()).toBeVisible({ timeout: this.timeout });
  774 |     return dialog;
  775 |   }
  776 | 
  777 |   async selectDeviceInModal(deviceName) {
  778 |     const searchInput = this.getAddDeviceSearchInput();
  779 |     const macAddress = extractMacAddress(deviceName);
  780 |     const searchTerms = [deviceName, macAddress].filter((term, index, values) => term && values.indexOf(term) === index);
  781 |     let option = null;
  782 |     let lastResultSummary = '';
  783 | 
  784 |     for (const searchTerm of searchTerms) {
  785 |       await searchInput.fill('');
  786 |       await searchInput.fill(searchTerm);
  787 |       await this.waitForUiSettled();
  788 | 
  789 |       const exactNameOption = this.page
  790 |         .locator('.device-selector-option')
  791 |         .filter({
  792 |           has: this.page.locator('.device-selector-option-name', {
  793 |             hasText: new RegExp(escapeRegExp(deviceName)),
  794 |           }),
  795 |         })
  796 |         .first();
  797 |       const macOption = macAddress
  798 |         ? this.page.locator('.device-selector-option').filter({ hasText: macAddress }).first()
  799 |         : exactNameOption;
  800 | 
  801 |       if (await exactNameOption.isVisible().catch(() => false)) {
  802 |         option = exactNameOption;
  803 |         break;
  804 |       }
  805 |       if (await macOption.isVisible().catch(() => false)) {
  806 |         option = macOption;
  807 |         break;
  808 |       }
  809 | 
  810 |       const resultTexts = await this.page
  811 |         .locator('.device-selector-option, .device-selector-empty')
  812 |         .evaluateAll((items) => items.map((item) => (item.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  813 |         .catch(() => []);
  814 |       lastResultSummary = resultTexts.length ? resultTexts.join('; ') : T.NO_DEVICES_FOUND;
  815 |     }
  816 | 
  817 |     if (!option) {
> 818 |       throw new Error(
      |             ^ Error: Required Bulk Deployment device test data was not found in Add Device modal. Expected device="". Searched="". Results="No devices found". Check the DEV account/device assignment or the BULK_DEVICE_* environment variables.
  819 |         `Required Bulk Deployment device test data was not found in Add Device modal. Expected device="${deviceName}". ` +
  820 |           `Searched="${searchTerms.join(', ')}". Results="${lastResultSummary || T.NO_DEVICES_FOUND}". ` +
  821 |           'Check the DEV account/device assignment or the BULK_DEVICE_* environment variables.'
  822 |       );
  823 |     }
  824 | 
  825 |     await option.click();
  826 |     const selectedDevice = this.page
  827 |       .locator('.device-selector-selected-name')
  828 |       .filter({ hasText: macAddress ? new RegExp(`${escapeRegExp(deviceName)}|${escapeRegExp(macAddress)}`) : deviceName })
  829 |       .first();
  830 |     if (!(await selectedDevice.isVisible().catch(() => false))) {
  831 |       await option.dispatchEvent('click');
  832 |     }
  833 |     await expect(selectedDevice).toBeVisible({ timeout: this.timeout });
  834 |   }
  835 | 
  836 |   async addDevicesByNames(deviceNames) {
  837 |     await this.openAddDeviceModal();
  838 |     for (const deviceName of deviceNames) {
  839 |       await this.selectDeviceInModal(deviceName);
  840 |     }
  841 |     const dialog = this.dialogByTitle(T.DIALOG_ADD_DEVICE);
  842 |     const addButton = dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(T.ADD)}$`) });
  843 |     await expect(addButton).toBeEnabled({ timeout: this.timeout });
  844 |     await addButton.click();
  845 |     await this.waitForToastOrNetwork();
  846 |     for (const deviceName of deviceNames) {
  847 |       await this.expectDeviceRowVisible(deviceName);
  848 |     }
  849 |   }
  850 | 
  851 |   async removeDeviceByName(deviceName) {
  852 |     await this.openDevicesTab();
  853 |     await this.selectRowAction(deviceName, T.REMOVE);
  854 |     const dialog = this.dialogByTitle(T.DIALOG_REMOVE_DEVICE);
  855 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  856 |     await dialog.getByRole('button', { name: T.REMOVE }).click();
  857 |     await this.waitForToastOrNetwork();
  858 |     await this.expectDeviceRowHidden(deviceName);
  859 |   }
  860 | 
  861 |   async searchDeviceInDeployment(keyword) {
  862 |     await this.openDevicesTab();
  863 |     const searchInput = this.getDeviceTableSearchInput();
  864 |     await searchInput.fill('');
  865 |     await searchInput.fill(keyword);
  866 |     await this.waitForUiSettled();
  867 |   }
  868 | 
  869 |   async openAddAppModal() {
  870 |     await this.openAppsTab();
  871 |     await this.addAppButton.click();
  872 |     const dialog = this.dialogByTitle(T.DIALOG_ADD_APP);
  873 |     await expect(dialog).toBeVisible({ timeout: this.timeout });
  874 |     await expect(this.getAddAppSearchInput()).toBeVisible({ timeout: this.timeout });
  875 |     return dialog;
  876 |   }
  877 | 
  878 |   async selectAppInModal(appName) {
  879 |     const searchInput = this.getAddAppSearchInput();
  880 |     await searchInput.fill('');
  881 |     await searchInput.fill(appName);
  882 | 
  883 |     // Wait for search results to finish loading (not just UI spinners)
  884 |     await expect.poll(async () => {
  885 |       const loadingCount = await this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count();
  886 |       const loadingText = await this.page.locator('.add-app-result-option, .empty-state, [class*="empty"]').filter({ hasText: /loading/i }).count();
  887 |       return loadingCount + loadingText;
  888 |     }, {
  889 |       timeout: this.timeout,
  890 |       message: `Waiting for app search results to finish loading for "${appName}"`,
  891 |     }).toBe(0).catch(() => {});
  892 | 
  893 |     const option = this.page
  894 |       .locator('.add-app-result-option')
  895 |       .filter({
  896 |         has: this.page.locator('.add-app-result-option-text', {
  897 |           hasText: new RegExp(`^${escapeRegExp(appName)}$`),
  898 |         }),
  899 |       })
  900 |       .first();
  901 | 
  902 |     // Retry: if option not visible, wait and try again
  903 |     if (!(await option.isVisible().catch(() => false))) {
  904 |       // Wait for UI to settle before retry
  905 |       await expect.poll(async () => this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count(), {
  906 |         timeout: 3000,
  907 |         message: `Waiting before retry for app "${appName}"`,
  908 |       }).toBe(0).catch(() => {});
  909 |       await searchInput.fill('');
  910 |       await searchInput.fill(appName);
  911 |       await expect.poll(async () => {
  912 |         const loadingCount = await this.page.locator('[aria-busy="true"], .loading, [class*="loading"]').count();
  913 |         return loadingCount;
  914 |       }, {
  915 |         timeout: this.timeout,
  916 |         message: `Retry: waiting for app search results for "${appName}"`,
  917 |       }).toBe(0).catch(() => {});
  918 |     }
```