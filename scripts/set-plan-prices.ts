/**
 * Set Stripe Price IDs for a Plan
 * 
 * Usage: npx tsx scripts/set-plan-prices.ts <planCode> <stripeProductId> <stripePriceId>
 * Example: npx tsx scripts/set-plan-prices.ts starter prod_123 price_456
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('Usage: npx tsx scripts/set-plan-prices.ts <planCode> <stripeProductId> <stripePriceId>');
        process.exit(1);
    }

    const [planCode, stripeProductId, stripePriceId] = args;

    console.log(`Updating plan '${planCode}'...`);
    console.log(`  Product ID: ${stripeProductId}`);
    console.log(`  Price ID:   ${stripePriceId}`);

    try {
        const plan = await prisma.plan.update({
            where: { code: planCode },
            data: {
                stripeProductId,
                stripePriceId
            }
        });

        console.log(`\n✅ Successfully updated plan '${plan.name}' (${plan.code})`);
    } catch (e) {
        console.error(`\n❌ Failed to update plan: ${(e as Error).message}`);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
