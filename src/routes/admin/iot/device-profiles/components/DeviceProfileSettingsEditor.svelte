<script lang="ts">
    import { Switch } from "$lib/components/ui/switch";
    import { Input } from "$lib/components/ui/input";
    import { Label } from "$lib/components/ui/label";
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "$lib/components/ui/select";
    import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
    import { Badge } from "$lib/components/ui/badge";

    // Props
    export let settings: any[] = [];
    export let availableSettings: any[] = [];

    // Function to get current value for a setting
    function getCurrentValue(key: string): string {
        const setting = settings.find((s) => s.key === key);
        return setting?.value || '';
    }

    // Function to update a setting value
    function updateSetting(key: string, value: string) {
        const settingIndex = settings.findIndex((s) => s.key === key);
        if (settingIndex >= 0) {
            settings[settingIndex] = { ...settings[settingIndex], value };
        } else {
            // Create new setting if it doesn't exist
            const settingDef = availableSettings.find((s) => s.key === key);
            if (settingDef) {
                settings.push({
                    key,
                    value,
                    dataType: settingDef.dataType,
                    label: settingDef.label,
                    category: settingDef.category,
                    order: settings.length
                });
            }
        }
        // Trigger reactivity
        settings = [...settings];
    }

    // Group settings by category
    $: groupedSettings = availableSettings.reduce((groups, setting) => {
        const category = setting.category || 'Other';
        if (!groups[category]) {
            groups[category] = [];
        }
        groups[category].push(setting);
        return groups;
    }, {});
</script>

<div class="space-y-6">
    {#each Object.entries(groupedSettings) as [category, categorySettings]}
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    {category}
                    <Badge variant="secondary">{categorySettings.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent class="space-y-4">
                {#each categorySettings as setting}
                    {@const settingData = setting}
                    <div class="flex items-center justify-between p-4 border rounded-lg">
                        <div class="flex-1">
                            <Label class="font-medium">{settingData.label}</Label>
                            <div class="text-sm text-muted-foreground">
                                Current Value: {getCurrentValue(settingData.key) || 'Not set'}
                            </div>
                        </div>
                        <div class="flex-1 max-w-xs">
                            {#if settingData.dataType === 'boolean'}
                                <Switch 
                                    checked={getCurrentValue(settingData.key) === 'enabled'}
                                    onCheckedChange={(checked) => updateSetting(settingData.key, checked ? 'enabled' : 'disabled')}
                                />
                            {:else if settingData.dataType === 'select'}
                                <Select 
                                    value={getCurrentValue(settingData.key)}
                                    onValueChange={(value) => updateSetting(settingData.key, value)}
                                >
                                    <SelectTrigger class="w-full">
                                        <SelectValue placeholder={`Select ${settingData.label}`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {#each settingData.options as option}
                                            <SelectItem value={option.value}>{option.label}</SelectItem>
                                        {/each}
                                    </SelectContent>
                                </Select>
                            {:else if settingData.dataType === 'time'}
                                <Input 
                                    type="time"
                                    value={getCurrentValue(settingData.key)}
                                    on:change={(e) => updateSetting(settingData.key, e.target?.value || '')}
                                />
                            {:else if settingData.dataType === 'password'}
                                <Input 
                                    type="password"
                                    value={getCurrentValue(settingData.key)}
                                    on:change={(e) => updateSetting(settingData.key, e.target?.value || '')}
                                    placeholder="••••••"
                                />
                            {:else}
                                <Input 
                                    value={getCurrentValue(settingData.key)}
                                    on:change={(e) => updateSetting(settingData.key, e.target?.value || '')}
                                />
                            {/if}
                        </div>
                    </div>
                {/each}
            </CardContent>
        </Card>
    {/each}
</div>
