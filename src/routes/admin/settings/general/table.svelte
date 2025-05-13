<script lang="ts">
  import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { ArrowUpCircle } from "lucide-svelte";
  import { createEventDispatcher } from "svelte";
  import type { Setting } from "@prisma/client";

  export let settings: Setting[] = [];
  
  const dispatch = createEventDispatcher<{
    restore: { setting: Setting };
    view: { setting: Setting };
  }>();

  function formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  function formatJSON(jsonString: string | null): string {
    if (!jsonString) return "{}";
    try {
      const obj = JSON.parse(jsonString);
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return jsonString;
    }
  }

  function truncateJSON(jsonString: string | null): string {
    if (!jsonString) return "{}";
    try {
      const obj = JSON.parse(jsonString);
      const keys = Object.keys(obj);
      return keys.length > 0 
        ? `${keys.length} settings (${keys.slice(0, 3).join(", ")}${keys.length > 3 ? '...' : ''})`
        : "Empty settings";
    } catch (e) {
      return "Invalid JSON";
    }
  }
</script>

<div class="w-full">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Status</TableHead>
        <TableHead>Updated</TableHead>
        <TableHead>Updated By</TableHead>
        <TableHead>Settings</TableHead>
        <TableHead class="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {#if settings.length === 0}
        <TableRow>
          <TableCell colspan="5" class="text-center py-4">No settings history found</TableCell>
        </TableRow>
      {:else}
        {#each settings as setting}
          <TableRow>
            <TableCell>
              {#if setting.isActive}
                <Badge variant="success">Active</Badge>
              {:else}
                <Badge variant="secondary">Historical</Badge>
              {/if}
            </TableCell>
            <TableCell>{formatDate(setting.updatedAt)}</TableCell>
            <TableCell>{setting.updatedBy}</TableCell>
            <TableCell>
              <div class="max-w-md truncate">
                {truncateJSON(setting.data)}
              </div>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  on:click={() => dispatch('view', { setting })}
                >
                  View
                </Button>
                {#if !setting.isActive}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    on:click={() => dispatch('restore', { setting })}
                  >
                    <ArrowUpCircle class="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                {/if}
              </div>
            </TableCell>
          </TableRow>
        {/each}
      {/if}
    </TableBody>
  </Table>
</div>
