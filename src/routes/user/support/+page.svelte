<script lang="ts">
    import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert";
    import { Button } from "$lib/components/ui/button";
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Textarea } from "$lib/components/ui/textarea";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs";
    import { HelpCircle, Mail, MessageSquare, Plus, Search } from "lucide-svelte";
    import UserPageLayout from "$lib/components/user/layout/UserPageLayout.svelte";
    
    // Define page metadata
    const pageTitle = "Support Center";
    
    // Define breadcrumbs
    const pageCrumbs = [
        ["Dashboard", "/user/dashboard"],
        ["Support", ""]
    ] as [string, string][];
    
    // Form state
    let name = "";
    let email = "";
    let subject = "";
    let message = "";
    let priority = "normal";
    let searchQuery = "";
    
    // Mock data for FAQs
    const faqs = [
        {
            question: "How do I reset my password?",
            answer: "You can reset your password by clicking on 'Forgot Password' on the login page and following the instructions sent to your email."
        },
        {
            question: "How do I update my billing information?",
            answer: "You can update your billing information by going to Settings > Billing and updating your payment method."
        },
        {
            question: "How do I contact support?",
            answer: "You can contact our support team 24/7 through this support center or by emailing support@example.com."
        },
        {
            question: "What payment methods do you accept?",
            answer: "We accept all major credit cards, PayPal, and bank transfers for payments."
        },
        {
            question: "How do I cancel my subscription?",
            answer: "You can cancel your subscription at any time by going to Settings > Billing and clicking 'Cancel Subscription'."
        }
    ];
    
    // Mock data for support tickets
    let tickets = [
        {
            id: "TKT-1001",
            subject: "Login issues",
            status: "Open",
            priority: "High",
            lastUpdated: "2025-05-18T10:30:00"
        },
        {
            id: "TKT-1000",
            subject: "Billing question",
            status: "Resolved",
            priority: "Normal",
            lastUpdated: "2025-05-15T14:20:00"
        }
    ];
    
    function handleSubmit() {
        // In a real app, this would submit the form to your backend
        alert('Support request submitted! We will get back to you soon.');
        
        // Reset form
        name = '';
        email = '';
        subject = '';
        message = '';
        priority = 'normal';
    }
    
    function createNewTicket() {
        // In a real app, this would open a new ticket form
        document.getElementById('new-ticket-tab')?.click();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
</script>

<UserPageLayout 
    title={pageTitle}
    crumbs={pageCrumbs}
    class="space-y-6"
>
    <div class="space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-2xl font-bold tracking-tight">How can we help you?</h1>
                <p class="text-muted-foreground">Find answers in our help center or contact our support team</p>
            </div>
            <Button onclick={createNewTicket}>
                <Plus class="mr-2 h-4 w-4" />
                New Support Ticket
            </Button>
        </div>
        
        <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search class="h-5 w-5 text-muted-foreground" />
            </div>
            <Input 
                type="search" 
                placeholder="Search help articles..." 
                bind:value={searchQuery}
                class="pl-10 w-full"
            />
        </div>
        
        <Tabs defaultValue="help" class="w-full">
            <TabsList class="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="help">Help Center</TabsTrigger>
                <TabsTrigger value="tickets">My Tickets</TabsTrigger>
                <TabsTrigger id="new-ticket-tab" value="new">New Ticket</TabsTrigger>
            </TabsList>
            
            <!-- Help Center Tab -->
            <TabsContent value="help" class="space-y-6">
                <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <!-- Help Card 1 -->
                    <Card>
                        <CardHeader class="pb-3">
                            <div class="flex items-center justify-between">
                                <CardTitle>Getting Started</CardTitle>
                                <HelpCircle class="h-5 w-5 text-primary" />
                            </div>
                            <CardDescription>New to our platform? Start here.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-2">
                            <p class="text-sm text-muted-foreground">
                                Learn the basics and get up and running quickly with our getting started guides and tutorials.
                            </p>
                            <Button variant="link" class="p-0 h-auto">View guides →</Button>
                        </CardContent>
                    </Card>
                    
                    <!-- Help Card 2 -->
                    <Card>
                        <CardHeader class="pb-3">
                            <div class="flex items-center justify-between">
                                <CardTitle>FAQ</CardTitle>
                                <HelpCircle class="h-5 w-5 text-primary" />
                            </div>
                            <CardDescription>Find answers to common questions.</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-2">
                            <p class="text-sm text-muted-foreground">
                                Browse our frequently asked questions to find quick solutions to common issues.
                            </p>
                            <Button variant="link" class="p-0 h-auto">View FAQs →</Button>
                        </CardContent>
                    </Card>
                    
                    <!-- Help Card 3 -->
                    <Card>
                        <CardHeader class="pb-3">
                            <div class="flex items-center justify-between">
                                <CardTitle>Contact Support</CardTitle>
                                <MessageSquare class="h-5 w-5 text-primary" />
                            </div>
                            <CardDescription>Can't find what you're looking for?</CardDescription>
                        </CardHeader>
                        <CardContent class="space-y-2">
                            <p class="text-sm text-muted-foreground">
                                Our support team is here to help. Contact us directly for personalized assistance.
                            </p>
                            <Button variant="link" class="p-0 h-auto" onclick={() => document.getElementById('new-ticket-tab')?.click()}>Contact Us →</Button>
                        </CardContent>
                    </Card>
                </div>
                
                <!-- FAQ Section -->
                <div class="space-y-4">
                    <h2 class="text-xl font-semibold">Frequently Asked Questions</h2>
                    <div class="space-y-2">
                        {#each faqs.filter(faq => 
                            !searchQuery || 
                            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
                        ) as faq}
                            <div class="border rounded-lg p-4">
                                <h3 class="font-medium">{faq.question}</h3>
                                <p class="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                            </div>
                        {/each}
                    </div>
                </div>
            </TabsContent>
            
            <!-- My Tickets Tab -->
            <TabsContent value="tickets" class="space-y-4">
                {#if tickets.length === 0}
                    <Alert>
                        <HelpCircle class="h-4 w-4" />
                        <AlertTitle>No support tickets yet</AlertTitle>
                        <AlertDescription>
                            You haven't created any support tickets yet. Click the "New Support Ticket" button to get started.
                        </AlertDescription>
                    </Alert>
                {:else}
                    <div class="space-y-2">
                        {#each tickets as ticket}
                            <div class="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <div class="font-medium">{ticket.subject}</div>
                                    <div class="text-sm text-muted-foreground">{ticket.id} • {ticket.status}</div>
                                </div>
                                <div class="text-right">
                                    <div class="text-sm font-medium">{ticket.priority} Priority</div>
                                    <div class="text-xs text-muted-foreground">
                                        {new Date(ticket.lastUpdated).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </TabsContent>
            
            <!-- New Ticket Tab -->
            <TabsContent value="new" class="space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Submit a Support Request</CardTitle>
                        <CardDescription>
                            Fill out the form below and our support team will get back to you as soon as possible.
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <Label for="name">Name</Label>
                                <Input id="name" bind:value={name} placeholder="Your name" />
                            </div>
                            <div class="space-y-2">
                                <Label for="email">Email</Label>
                                <Input id="email" type="email" bind:value={email} placeholder="your@email.com" />
                            </div>
                        </div>
                        <div class="space-y-2">
                            <Label for="subject">Subject</Label>
                            <Input id="subject" bind:value={subject} placeholder="Briefly describe your issue" />
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-2">
                                <Label for="priority">Priority</Label>
                                <Select bind:value={priority}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="low">Low</SelectItem>
                                        <SelectItem value="normal">Normal</SelectItem>
                                        <SelectItem value="high">High</SelectItem>
                                        <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <Label for="message">Message</Label>
                            <Textarea 
                                id="message" 
                                bind:value={message} 
                                placeholder="Please describe your issue in detail..." 
                                class="min-h-[150px]"
                            />
                        </div>
                        <div class="flex justify-end">
                            <Button on:click={handleSubmit}>
                                <Mail class="mr-2 h-4 w-4" />
                                Submit Request
                            </Button>
                        </div>
                    </CardContent>
                </Card>
                
                <div class="bg-muted/50 p-4 rounded-lg">
                    <h3 class="font-medium mb-2">Need immediate assistance?</h3>
                    <p class="text-sm text-muted-foreground">
                        Call our support team at <a href="tel:+18001234567" class="text-primary hover:underline">+1 (800) 123-4567</a> or 
                        email us at <a href="mailto:support@example.com" class="text-primary hover:underline">support@example.com</a>.
                    </p>
                </div>
            </TabsContent>
        </Tabs>
    </div>
</UserPageLayout>
