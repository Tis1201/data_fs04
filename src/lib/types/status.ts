import type { VariantProps } from 'tailwind-variants';
import { badgeVariants } from '$lib/components/ui/badge';

export type StatusVariant = VariantProps<typeof badgeVariants>['variant'];

export interface StatusMapping {
    variant: StatusVariant;
    label?: string;
    icon?: string;
}
