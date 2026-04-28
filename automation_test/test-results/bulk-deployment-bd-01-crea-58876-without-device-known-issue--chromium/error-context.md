# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bulk-deployment\bd-01-create.test.js >> Bulk Deployment - Create - Known Issues >> TC-BULK-CREATE-006: Cannot create deployment without device (known issue)
- Location: tests\bulk-deployment\bd-01-create.test.js:179:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
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
                  - paragraph [ref=e151]: Bulk Auto known-no-device-1777358428475-369
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
                  - paragraph [ref=e187]: Created by Hoai Vu at Apr 27, 2026, 11:40 PM
                  - paragraph [ref=e188]: Last updated by Hoai Vu at Apr 27, 2026, 11:40 PM
            - generic [ref=e189]:
              - tablist [ref=e190]:
                - button "Devices" [active] [ref=e191] [cursor=pointer]:
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
                    - button "Add Device" [ref=e220] [cursor=pointer]:
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
  96  |     });
  97  |     await context.bulkDeploymentPage.saveAsDraftExpectBlocked();
  98  | 
  99  |     await context.bulkDeploymentPage.openAddDeploymentModal();
  100 |     await context.bulkDeploymentPage.fillDeploymentForm({
  101 |       name: createDeploymentData('missing-os').name,
  102 |       batchSize: bulkDeploymentConfig.defaultBatchSize,
  103 |       schedule: bulkDeploymentConfig.defaultSchedule,
  104 |     });
  105 |     await context.bulkDeploymentPage.saveAsDraftExpectBlocked();
  106 | 
  107 |     await context.bulkDeploymentPage.openAddDeploymentModal();
  108 |     await context.bulkDeploymentPage.fillDeploymentForm({
  109 |       name: createDeploymentData('missing-batch').name,
  110 |       targetOS: bulkDeploymentConfig.defaultTargetOS,
  111 |       schedule: bulkDeploymentConfig.defaultSchedule,
  112 |     });
  113 |     await context.bulkDeploymentPage.saveAsDraftExpectBlocked();
  114 | 
  115 |     setActualResult(testInfo, 'Save as Draft remained disabled for each missing required field (Name, OS, Batch Size)');
  116 |   });
  117 | 
  118 |   test('TC-BULK-CREATE-007, 010, 011, 013: Field max-length, defaults, and Schedule None', async ({ page }, testInfo) => {
  119 |     setTestCaseMetadata(testInfo, {
  120 |       testcaseId: 'TC-BULK-CREATE-007,010,011,013',
  121 |       category: 'Bulk Deployment Create',
  122 |       title: 'Name/Description max-length limits, default Version, Schedule None behavior',
  123 |       precondition: 'User is logged in; Add Deployment modal is available',
  124 |       steps: [
  125 |         'Enter Name > 50 chars → verify capped at 50 and counter shows 50/50',
  126 |         'Enter Description > 200 chars → verify capped at 200 and counter shows 200/200',
  127 |         'Open modal and verify Version defaults to 1.0.0',
  128 |         'Create draft with Schedule None → Start On and End On should be empty/dash',
  129 |       ],
  130 |       expected: 'Name capped at 50; Description at 200; Version defaults correctly; Schedule None accepted',
  131 |     });
  132 | 
  133 |     const context = createBulkDeploymentContext(page);
  134 | 
  135 |     await context.bulkDeploymentPage.openAddDeploymentModal();
  136 |     const nameInput = context.bulkDeploymentPage.inputByLabel(T.FORM.NAME_LABEL);
  137 |     await nameInput.fill(makeString(55, 'N'));
  138 |     expect((await nameInput.inputValue()).length).toBe(BULK_DEPLOYMENT.LIMITS.DEPLOYMENT_NAME_MAX);
  139 |     await expect(context.bulkDeploymentPage.getCharCounterNameMax()).toBeVisible();
  140 | 
  141 |     const descTextarea = context.bulkDeploymentPage.textareaByLabel(T.FORM.DESCRIPTION_LABEL);
  142 |     await descTextarea.fill(makeString(205, 'D'));
  143 |     expect((await descTextarea.inputValue()).length).toBe(BULK_DEPLOYMENT.LIMITS.DESCRIPTION_MAX);
  144 |     await expect(context.bulkDeploymentPage.getCharCounterDescMax()).toBeVisible();
  145 | 
  146 |     const versionValue = await context.bulkDeploymentPage.inputByLabel(T.FORM.VERSION_LABEL).inputValue();
  147 |     expect(versionValue).toBe(bulkDeploymentConfig.defaultVersion);
  148 | 
  149 |     const noneData = createDeploymentData('schedule-none');
  150 |     await context.bulkDeploymentPage.createDraftDeployment(noneData);
  151 |     expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_START_ON));
  152 |     expect(['', '-']).toContain(await context.bulkDeploymentPage.getOverviewValue(T.OVERVIEW_FIELD_END_ON));
  153 | 
  154 |     setActualResult(testInfo, 'Name/Description limits enforced; Version defaulted correctly; Schedule None accepted');
  155 |   });
  156 | });
  157 | 
  158 | test.describe('Bulk Deployment - Create - Known Issues', () => {
  159 |   test('TC-BULK-CREATE-005: Cannot create deployment without app (known issue)', async ({ page }, testInfo) => {
  160 |     test.fail(true, 'Known issue: system creates draft without apps and Publish remains enabled.');
  161 |     setTestCaseMetadata(testInfo, {
  162 |       testcaseId: 'TC-BULK-CREATE-005',
  163 |       category: 'Bulk Deployment Create',
  164 |       title: 'Cannot create deployment without adding app',
  165 |       precondition: 'Business rule expects at least one app before publish is allowed',
  166 |       steps: ['Create draft without app', 'Verify Publish is disabled'],
  167 |       expected: 'Publish should be disabled when no app is assigned',
  168 |     });
  169 | 
  170 |     const context = createBulkDeploymentContext(page);
  171 |     await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-app'));
  172 |     await context.bulkDeploymentPage.openAppsTab();
  173 |     await context.bulkDeploymentPage.expectAppsEmptyState();
  174 |     const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
  175 |     setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
  176 |     expect(publishEnabled).toBe(false);
  177 |   });
  178 | 
  179 |   test('TC-BULK-CREATE-006: Cannot create deployment without device (known issue)', async ({ page }, testInfo) => {
  180 |     test.fail(true, 'Known issue: system creates draft without devices and Publish remains enabled.');
  181 |     setTestCaseMetadata(testInfo, {
  182 |       testcaseId: 'TC-BULK-CREATE-006',
  183 |       category: 'Bulk Deployment Create',
  184 |       title: 'Cannot create deployment without assigning device',
  185 |       precondition: 'Business rule expects at least one device before publish is allowed',
  186 |       steps: ['Create draft without device', 'Verify Publish is disabled'],
  187 |       expected: 'Publish should be disabled when no device is assigned',
  188 |     });
  189 | 
  190 |     const context = createBulkDeploymentContext(page);
  191 |     await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('known-no-device'));
  192 |     await context.bulkDeploymentPage.openDevicesTab();
  193 |     await context.bulkDeploymentPage.expectDevicesEmptyState();
  194 |     const publishEnabled = await context.bulkDeploymentPage.publishButton.isEnabled();
  195 |     setActualResult(testInfo, `Publish enabled=${publishEnabled}. Defect candidate.`);
> 196 |     expect(publishEnabled).toBe(false);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  197 |   });
  198 | });
  199 | 
  200 | test.describe('Bulk Deployment - Create - Optional Fields and Edge Cases', () => {
  201 |   test('TC-BULK-CREATE-008: Empty Description shows dash in overview', async ({ page }, testInfo) => {
  202 |     setTestCaseMetadata(testInfo, {
  203 |       testcaseId: 'TC-BULK-CREATE-008',
  204 |       category: 'Bulk Deployment Create',
  205 |       title: 'Creating a deployment with empty Description shows dash in overview',
  206 |       precondition: 'User is logged in',
  207 |       steps: ['Create with empty Description → Description should display dash'],
  208 |       expected: 'Description overview shows dash when created with empty value',
  209 |     });
  210 | 
  211 |     const context = createBulkDeploymentContext(page);
  212 |     await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('empty-desc', { description: '' }));
  213 |     await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DESCRIPTION, '-');
  214 | 
  215 |     setActualResult(testInfo, 'Empty description shows dash in overview');
  216 |   });
  217 | 
  218 |   test('TC-BULK-CREATE-009: Two deployments with duplicate names are created with different IDs', async ({ page }, testInfo) => {
  219 |     setTestCaseMetadata(testInfo, {
  220 |       testcaseId: 'TC-BULK-CREATE-009',
  221 |       category: 'Bulk Deployment Create',
  222 |       title: 'Creating two drafts with the same name results in two separate deployments with different IDs',
  223 |       precondition: 'User is logged in',
  224 |       steps: ['Create two drafts with same name → both created with different IDs'],
  225 |       expected: 'Both deployments are created; their IDs are unique',
  226 |     });
  227 | 
  228 |     const context = createBulkDeploymentContext(page);
  229 |     const dupName = createDeploymentData('dup-name').name;
  230 |     const first = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-first', { name: dupName }));
  231 |     const second = await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('dup-second', { name: dupName }));
  232 |     expect(first.id).toBeTruthy();
  233 |     expect(second.id).toBeTruthy();
  234 |     expect(second.id).not.toBe(first.id);
  235 | 
  236 |     setActualResult(testInfo, `Two drafts with same name created with different IDs: ${first.id} vs ${second.id}`);
  237 |   });
  238 | 
  239 |   test('TC-BULK-CREATE-014: Cancelling Add Deployment modal does not create a deployment', async ({ page }, testInfo) => {
  240 |     setTestCaseMetadata(testInfo, {
  241 |       testcaseId: 'TC-BULK-CREATE-014',
  242 |       category: 'Bulk Deployment Create',
  243 |       title: 'Cancelling the Add Deployment modal does not create any deployment',
  244 |       precondition: 'User is logged in',
  245 |       steps: ['Open modal, fill form, click Cancel → verify no deployment found in list'],
  246 |       expected: 'No deployment is created after cancel',
  247 |     });
  248 | 
  249 |     const context = createBulkDeploymentContext(page);
  250 |     const cancelData = createDeploymentData('cancel-create');
  251 |     await context.bulkDeploymentPage.openAddDeploymentModal();
  252 |     await context.bulkDeploymentPage.fillDeploymentForm(cancelData);
  253 |     await context.bulkDeploymentPage.cancelButton.click();
  254 |     await expect(context.bulkDeploymentPage.addDeploymentModalTitle.first()).toBeHidden();
  255 |     await context.bulkDeploymentPage.searchDeployment(cancelData.name);
  256 |     await context.bulkDeploymentPage.expectNoDeploymentResults();
  257 | 
  258 |     setActualResult(testInfo, 'Cancel did not create deployment; no results found in list');
  259 |   });
  260 | 
  261 |   test('TC-BULK-CREATE-015: Enabling Reboot Device and Force Update shows Enable in overview', async ({ page }, testInfo) => {
  262 |     setTestCaseMetadata(testInfo, {
  263 |       testcaseId: 'TC-BULK-CREATE-015',
  264 |       category: 'Bulk Deployment Create',
  265 |       title: 'Creating with Reboot Device and Force Update enabled shows Enable for both in overview',
  266 |       precondition: 'User is logged in',
  267 |       steps: ['Create with Reboot+Force Update enabled → verify Enable values in overview'],
  268 |       expected: 'Reboot Device and Force Update both show Enable in overview',
  269 |     });
  270 | 
  271 |     const context = createBulkDeploymentContext(page);
  272 |     await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('device-behavior', { rebootDevice: true, forceUpdate: true }));
  273 |     await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_REBOOT_DEVICE, 'Enable');
  274 |     await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_FORCE_UPDATE, 'Enable');
  275 | 
  276 |     setActualResult(testInfo, 'Reboot Device and Force Update both shown as Enable');
  277 |   });
  278 | 
  279 |   test('TC-BULK-CREATE-016: Deployment name with leading/trailing spaces is trimmed on save', async ({ page }, testInfo) => {
  280 |     setTestCaseMetadata(testInfo, {
  281 |       testcaseId: 'TC-BULK-CREATE-016',
  282 |       category: 'Bulk Deployment Create',
  283 |       title: 'Deployment name with leading and trailing whitespace is trimmed when saved',
  284 |       precondition: 'User is logged in',
  285 |       steps: ['Create with name padded with spaces → trimmed name shown in overview'],
  286 |       expected: 'Overview shows trimmed name without leading/trailing spaces',
  287 |     });
  288 | 
  289 |     const context = createBulkDeploymentContext(page);
  290 |     const trimmedName = createDeploymentData('trim-name').name;
  291 |     await context.bulkDeploymentPage.createDraftDeployment(createDeploymentData('trim-submit', { name: `  ${trimmedName}  ` }));
  292 |     await context.bulkDeploymentPage.expectOverviewValue(T.OVERVIEW_FIELD_DEPLOYMENT_NAME, trimmedName);
  293 | 
  294 |     setActualResult(testInfo, `Name trimmed correctly to "${trimmedName}"`);
  295 |   });
  296 | 
```