<script lang="ts">
    import { FileText, ExternalLink, Download } from "lucide-svelte";
    import AdminPageLayout from "$lib/components/admin/layout/AdminPageLayout.svelte";
    import Card from "$lib/components/ui/card/card.svelte";
    import { Badge } from "$lib/components/ui/badge";
    import { Button } from "$lib/components/ui/button";
    import RelativeDate from "$lib/components/ui_components_sveltekit/date/RelativeDate.svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    const pageTitle = "Invoices";
    const pageCrumbs = [
        ["Dashboard", "/admin/dashboard"],
        ["Billing", ""],
        ["Invoices", ""],
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

<AdminPageLayout title={pageTitle} crumbs={pageCrumbs}>
    <div class="space-y-6">
        <div class="flex justify-between items-center">
            <p class="text-muted-foreground">
                View all Stripe invoices across all customers.
            </p>
            <a
                href="https://dashboard.stripe.com/invoices"
                target="_blank"
                rel="noopener noreferrer"
            >
                <Button variant="outline" size="sm">
                    <ExternalLink class="h-4 w-4 mr-2" />
                    View in Stripe
                </Button>
            </a>
        </div>

        {#if data.invoices.length === 0}
            <Card class="p-8 text-center">
                <FileText
                    class="h-12 w-12 mx-auto text-muted-foreground mb-4"
                />
                <h3 class="font-medium text-lg">No Invoices Found</h3>
                <p class="text-muted-foreground mt-2">
                    No invoices have been generated yet.
                </p>
            </Card>
        {:else}
            <div class="border rounded-lg overflow-hidden">
                <table class="w-full text-sm">
                    <thead class="bg-muted/50">
                        <tr>
                            <th class="text-left p-3 font-medium">Number</th>
                            <th class="text-left p-3 font-medium">Customer</th>
                            <th class="text-left p-3 font-medium">Amount</th>
                            <th class="text-left p-3 font-medium">Status</th>
                            <th class="text-left p-3 font-medium">Created</th>
                            <th class="text-right p-3 font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.invoices as invoice}
                            <tr
                                class="border-t hover:bg-muted/25 transition-colors"
                            >
                                <td class="p-3 font-mono text-xs">
                                    {invoice.number || invoice.id}
                                </td>
                                <td class="p-3">
                                    <div class="flex flex-col">
                                        <span class="font-medium"
                                            >{invoice.customer_name ||
                                                "Unknown"}</span
                                        >
                                        <span
                                            class="text-xs text-muted-foreground"
                                            >{invoice.customer_email}</span
                                        >
                                    </div>
                                </td>
                                <td class="p-3 font-medium">
                                    {formatMoney(
                                        invoice.amount_due,
                                        invoice.currency,
                                    )}
                                </td>
                                <td class="p-3">
                                    <Badge
                                        class={getStatusColor(
                                            invoice.status || "unknown",
                                        )}
                                    >
                                        {invoice.status}
                                    </Badge>
                                </td>
                                <td class="p-3 text-muted-foreground">
                                    <RelativeDate
                                        date={new Date(invoice.created * 1000)}
                                    />
                                </td>
                                <td class="p-3 text-right">
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
                                                    class="h-8 w-8"
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
                                                    class="h-8 w-8"
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
</AdminPageLayout>
