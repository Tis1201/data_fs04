<script lang="ts">
    import {
        FileText,
        ExternalLink,
        Download,
        CreditCard,
        Receipt,
    } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Invoices";
    const pageCrumbs = [
        ["billing", "/user/settings/billing"],
        ["invoices", ""],
    ] as [string, string][];

    function getStatusColor(status: string) {
        switch (status) {
            case "paid":
                return "bg-green-100 text-green-800";
            case "open":
                return "bg-blue-100 text-blue-800";
            case "void":
                return "bg-gray-100 text-gray-800";
            case "uncollectible":
                return "bg-red-100 text-red-800";
            case "draft":
                return "bg-gray-100 text-gray-600";
            default:
                return "bg-gray-100 text-gray-800";
        }
    }

    function formatMoney(amount: number, currency: string) {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency.toUpperCase(),
        }).format(amount / 100);
    }
</script>

<UserPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-6 max-w-5xl">
        <div class="flex justify-between items-center">
            <p class="text-muted-foreground">
                History of your subscription payments and invoices.
            </p>
        </div>

        {#if data.invoices.length === 0}
            <Card class="p-8 text-center bg-muted/50 border-dashed">
                <Receipt
                    class="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50"
                />
                <h3 class="font-medium text-lg">No Invoices</h3>
                <p class="text-muted-foreground mt-2 text-sm">
                    You haven't generated any invoices yet. Once you subscribe
                    to a plan, your invoices will appear here.
                </p>
                <div class="mt-6">
                    <a href="/user/settings/billing">
                        <Button variant="outline">
                            <CreditCard class="h-4 w-4 mr-2" />
                            View Plans
                        </Button>
                    </a>
                </div>
            </Card>
        {:else}
            <div class="border rounded-lg overflow-hidden bg-white shadow-sm">
                <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b">
                        <tr>
                            <th
                                class="text-left p-4 font-medium text-muted-foreground"
                                >Date</th
                            >
                            <th
                                class="text-left p-4 font-medium text-muted-foreground"
                                >Amount</th
                            >
                            <th
                                class="text-left p-4 font-medium text-muted-foreground"
                                >Status</th
                            >
                            <th
                                class="text-left p-4 font-medium text-muted-foreground hidden sm:table-cell"
                                >Number</th
                            >
                            <th
                                class="text-right p-4 font-medium text-muted-foreground"
                                >Download</th
                            >
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        {#each data.invoices as invoice}
                            <tr class="hover:bg-muted/25 transition-colors">
                                <td class="p-4">
                                    <RelativeDate
                                        date={new Date(invoice.created * 1000)}
                                    />
                                </td>
                                <td class="p-4 font-medium">
                                    {formatMoney(
                                        invoice.amount_due,
                                        invoice.currency,
                                    )}
                                </td>
                                <td class="p-4">
                                    <Badge
                                        class={getStatusColor(
                                            invoice.status || "unknown",
                                        )}
                                        variant="outline"
                                    >
                                        {invoice.status}
                                    </Badge>
                                </td>
                                <td
                                    class="p-4 hidden sm:table-cell font-mono text-xs text-muted-foreground"
                                >
                                    {invoice.number || invoice.id}
                                </td>
                                <td class="p-4 text-right">
                                    <div class="flex justify-end gap-2">
                                        {#if invoice.hosted_invoice_url}
                                            <a
                                                href={invoice.hosted_invoice_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="View Invoice"
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    class="h-8 w-8 text-muted-foreground hover:text-primary"
                                                >
                                                    <ExternalLink
                                                        class="h-4 w-4"
                                                    />
                                                </Button>
                                            </a>
                                        {/if}
                                        {#if invoice.pdf}
                                            <a
                                                href={invoice.pdf}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Download PDF"
                                            >
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    class="h-8 w-8 text-muted-foreground hover:text-primary"
                                                >
                                                    <Download class="h-4 w-4" />
                                                </Button>
                                            </a>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</UserPageLayout>
