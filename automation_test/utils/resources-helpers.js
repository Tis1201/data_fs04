const ResourcesPage = require('../pages/resources/resources-page');

function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}

async function cleanupResource(rs, resourceName) {
    try { await rs.gotoList(); } catch (e) { console.log(`  Cleanup gotoList failed: ${getErrorMessage(e)}`); }
    try {
        await rs.searchFor(resourceName);
        if (await rs.resourceRowByName(resourceName).isVisible()) {
            await rs.deleteResource(resourceName);
            console.log(`  Cleanup: "${resourceName}" deleted`);
        }
    } catch (e) { console.log(`  Cleanup delete failed: ${getErrorMessage(e)}`); }
    try {
        if (await rs.modalBase.isVisible()) {
            await rs.closeModal();
        }
    } catch (e) { console.log(`  Cleanup modal close failed: ${getErrorMessage(e)}`); }
}

async function createResourceViaModal(rs, resourceName, filePath) {
    await rs.createResourceViaModal(resourceName, filePath);
}

async function restoreResourceName(page, resourceId, resourceName) {
    try {
        const rs = new ResourcesPage(page, resourceId);
        await rs.gotoDetail();
        await rs.editSetButton.click();
        await rs.modalBase.waitFor({ state: 'visible', timeout: 10000 });
        await rs.resourceNameInput.clear();
        await rs.resourceNameInput.fill(resourceName);
        await rs.saveResourceModal();
        await rs.waitForSuccessToast().catch(e => console.log(`  Restore toast skipped: ${getErrorMessage(e)}`));
        console.log(`  Restored resource name to "${resourceName}"`);
    } catch (e) {
        console.log(`  Restore failed: ${getErrorMessage(e)}`);
    }
}

async function cleanupAutoTestResources(page) {
    const rs = new ResourcesPage(page);
    let cleaned = 0;
    let attempts = 0;
    const maxAttempts = 10;
    console.log('\n  === Global Cleanup: Removing AutoTest resources ===');

    while (attempts < maxAttempts) {
        attempts++;
        try {
            await rs.gotoList();
            await rs.searchFor('AutoTest');
            const rows = await rs.extractResourceListData();
            const autoTestRows = rows.filter(row => /AutoTest/i.test(row.rawText));
            if (autoTestRows.length === 0) break;

            for (const row of autoTestRows) {
                const namePart = row.parts.find(part => /^AutoTest/i.test(part));
                if (!namePart) continue;
                try {
                    await rs.deleteResource(namePart);
                    cleaned++;
                    console.log(`  Cleanup: deleted "${namePart}"`);
                } catch (e) {
                    console.log(`  Cleanup: failed to delete "${namePart}": ${getErrorMessage(e)}`);
                }
            }
        } catch (e) {
            console.log(`  Cleanup attempt ${attempts} failed: ${getErrorMessage(e)}`);
            break;
        }
    }

    console.log(`  Global Cleanup complete: ${cleaned} test resources removed`);
}

module.exports = {
    getErrorMessage,
    cleanupResource,
    createResourceViaModal,
    restoreResourceName,
    cleanupAutoTestResources,
};
