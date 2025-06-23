import type { VariantProps } from 'class-variance-authority';
import type { Badge } from '$lib/components/ui/badge';

export type StatusVariant = VariantProps<typeof Badge>['variant'];

export interface StatusMapping {
    variant: StatusVariant;
    label?: string;
    icon?: string;
}
