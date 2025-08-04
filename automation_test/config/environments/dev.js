require('dotenv').config();

module.exports = {
    apiBaseURL: 'http://localhost:5173/auth/login',
    baseURL: 'http://localhost:5173/auth/login',
    username: 'hoan@gmail.com',
    password: '123',
    pageURL: {
        preconditions: {
            tags: ['auto_test', 'auto_test 2', 'auto_test 3'],
        },
        accounts: {
            url: 'http://localhost:5173/admin/accounts/accounts',
            name: 'auto_test Account',
            description: 'auto_test Account',
        },
        companies: {
            url: 'http://localhost:5173/admin/accounts/companies',
            name: 'Test Company',
            accountName: 'Test Account',
            contactEmail: 'test@company.com',
        },
        users: {
            url: 'http://localhost:5173/admin/users',
            email: 'test@example.com',
            name: 'Test User',
        },
        groups: {
            url: 'http://localhost:5173/admin/accounts/groups',
            name: 'Test Group',
            accountName: 'Test Account',
        }
    }
};
