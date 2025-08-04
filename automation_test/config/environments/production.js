module.exports = {
    apiBaseURL: 'https://engage-api-dev.spectrio.com/',
    baseURL: 'https://engage-app-dev.spectrio.com/',
    username: 'hoan.nguyen@spectrio.com',
    password: 'Hoan@123',
    pageURL: {
        tag:{
            url: 'https://engage-app-dev.spectrio.com/tags',
            name: 'playwright_test7'
        },
        asset: {
            url: 'https://engage-app-dev.spectrio.com/assets',
            name: 'playwright_test7 Asset',
            description: 'playwright_test7',
            tag: 'playwright_test7',
            subFolderName:'playwright_test7 sub folder'
        },
        layout: {
            url: 'https://v3-dev.inreality.com/v3/auth0/manage/layouts',
            name: 'playwright_test7',
        },
        venue: {
            url: 'https://v3-dev.inreality.com/v3/auth0/manage/stores',
            name: 'playwright_test7',
            mac: '68:1D:EF:32:4C:9A'
        },
        rule: {
            url: 'https://v3-dev.inreality.com/v3/auth0/rules',
            names: [
                {
                    ruleName: 'Rule AVA',
                    conditions: ['Activity Detected', 'Face Detected', 'Engaged']
                },
                {
                    ruleName: 'Rule PnP',
                    conditions: ['Activity Detected', 'Engaged']
                }
            ],
            tag: 'playwright_test8oct',
            username: 'rvh_readonly',
            password: 'P2UK8P'
        },
        device:{
            url: 'https://v3-dev.inreality.com/v3/auth0/devices'
        }
    }
};
