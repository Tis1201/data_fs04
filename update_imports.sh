#!/bin/bash

# This script updates import statements for admin components that have been moved
# from $lib/components/ui_components_sveltekit/layout/AdminPageLayout to $lib/components/admin

# Find files with direct imports of AdminPageLayout.svelte
find src/routes -type f -name "*.svelte" -exec sed -i '' 's|import AdminPageLayout from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminPageLayout.svelte";|import { AdminPageLayout } from "$lib/components/admin";|g' {} \;

# Find files with direct imports of AdminCard.svelte
find src/routes -type f -name "*.svelte" -exec sed -i '' 's|import AdminCard from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout/AdminCard.svelte";|import { AdminCard } from "$lib/components/admin";|g' {} \;

# Find files that import from the AdminPageLayout directory using destructuring
find src/routes -type f -name "*.svelte" -exec sed -i '' 's|import { AdminPageLayout, AdminCard } from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout";|import { AdminPageLayout, AdminCard } from "$lib/components/admin";|g' {} \;

# Find files that import CompactInfoGrid and CompactInfoItem
find src/routes -type f -name "*.svelte" -exec sed -i '' 's|import { AdminPageLayout, AdminCard, CompactInfoGrid, CompactInfoItem } from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout";|import { AdminPageLayout, AdminCard, CompactInfoGrid, CompactInfoItem } from "$lib/components/admin";|g' {} \;

# Find files that only import AdminCard using destructuring
find src/routes -type f -name "*.svelte" -exec sed -i '' 's|import { AdminCard } from "$lib/components/ui_components_sveltekit/layout/AdminPageLayout";|import { AdminCard } from "$lib/components/admin";|g' {} \;

echo "Import statements updated successfully!"
