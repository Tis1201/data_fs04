import 'dotenv/config';
import Redis from 'ioredis';

async function testConnection() {
    const url = process.env.REDIS_URL;

    if (!url) {
        console.error('❌ REDIS_URL is not defined in environment variables');
        process.exit(1);
    }

    console.log(`Testing connection to: ${url.replace(/:[^:@]*@/, ':****@')}`); // Hide password in logs

    const client = new Redis(url, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null // Don't retry, fail fast
    });

    try {
        await new Promise((resolve, reject) => {
            client.once('connect', () => {
                console.log('✅ Connected to Redis successfully!');
                resolve(true);
            });
            client.once('error', (err) => {
                reject(err);
            });
        });

        // Test write/read
        await client.set('test_key', 'hello_world');
        const value = await client.get('test_key');

        if (value === 'hello_world') {
            console.log('✅ Write/Read test passed');
        } else {
            console.error('❌ Write/Read test failed: value mismatch');
        }

        await client.del('test_key');

    } catch (error) {
        console.error('❌ Connection failed:', error instanceof Error ? error.message : error);
    } finally {
        client.disconnect();
    }
}

testConnection();
