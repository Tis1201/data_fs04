// =============================================================================
// DESIGN SYSTEM COMPONENTS - Exports
// =============================================================================

// UI Components
export { default as Button } from './Button.svelte';
export { default as Tag } from './Tag.svelte';
export { default as Badge } from './Badge.svelte';
export { default as Avatar } from './Avatar.svelte';
export { default as InputField } from './InputField.svelte';
export { default as Checkbox } from './Checkbox.svelte';
export { default as Radio } from './Radio.svelte';
export { default as CheckCircle } from './CheckCircle.svelte';
export { default as Toggle } from './Toggle.svelte';
export { default as TextField } from './TextField.svelte';
export { default as TextareaField } from './TextareaField.svelte';
export { default as DataTable } from './DataTable.svelte';
export { default as Card } from './Card.svelte';
export { default as Modal } from './Modal.svelte';
export { default as Breadcrumbs } from './Breadcrumbs.svelte';
export { default as FileUpload } from './FileUpload.svelte';
export { default as Dropdown } from './Dropdown.svelte';
export { default as ProgressBar } from './ProgressBar.svelte';
export { default as Tab } from './Tab.svelte';
export { default as TabGroup } from './TabGroup.svelte';
export { default as VerificationCodeInput } from './VerificationCodeInput.svelte';
export { default as Divider } from './Divider.svelte';
export { default as Tooltip } from './Tooltip.svelte';
export { default as Alert } from './Alert.svelte';
export { default as TopNavigation } from './TopNavigation.svelte';
export { default as Sidebar } from './Sidebar.svelte';
export { default as ActionMenu } from './ActionMenu.svelte';
export { default as ColumnFilter } from './ColumnFilter.svelte';
export { default as BulkActionsBar } from './BulkActionsBar.svelte';
export { default as UsageIndicators } from './UsageIndicators.svelte';
/** @deprecated Use DataTable with column configuration instead */
export { default as DeviceTable } from './DeviceTable.svelte';

// Button Types
export type ButtonVariant = 'filled' | 'outline' | 'text' | 'ghost';
export type ButtonColor = 'primary' | 'gray' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Badge Types (12 colors from Figma)
export type BadgeColor = 
    | 'gray' 
    | 'error' 
    | 'warning' 
    | 'yellow'
    | 'success' 
    | 'teal'
    | 'blue-light' 
    | 'blue'
    | 'indigo'
    | 'purple'
    | 'pink'
    | 'rose';
export type BadgeSize = 'sm' | 'md' | 'lg';
export type BadgeVariant = 'filled' | 'outline';

// Tag Types
export type TagSize = 'sm' | 'md' | 'lg';

// Input Types
export type InputState = 'default' | 'disabled' | 'focused' | 'success' | 'error';
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'datetime-local' | 'time';

// Textarea Types
export type TextareaState = 'default' | 'disabled' | 'focused' | 'success' | 'error';

// TextField Types
export type TextFieldDisplay = 
    | 'text' 
    | 'text-card' 
    | 'status' 
    | 'multi-badge' 
    | 'multi-chip' 
    | 'avatar' 
    | 'checkbox' 
    | 'radio' 
    | 'file';

// Avatar Types
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Checkbox Types
export type CheckboxSize = 'sm' | 'md';
export type CheckboxState = 'default' | 'hover' | 'disabled';

// Radio Types
export type RadioSize = 'sm' | 'md';
export type RadioState = 'default' | 'hover' | 'disabled';

// CheckCircle Types
export type CheckCircleSize = 'sm' | 'md';
export type CheckCircleState = 'default' | 'hover' | 'disabled';

// Toggle Types
export type ToggleSize = 'sm' | 'md';

// DataTable Types
export type CellType = 
    | 'text' 
    | 'textWithSupporting'
    | 'number' 
    | 'rowNumber'
    | 'date' 
    | 'datetime'
    | 'relativeTime'
    | 'status' 
    | 'badge'
    | 'badgeOutline'
    | 'multiBadge'
    | 'multiTag'
    | 'chip'
    | 'usageIndicators'
    | 'avatar' 
    | 'avatarWithName'
    | 'file'
    | 'payment'
    | 'progress'
    | 'toggle'
    | 'pin'
    | 'actions'
    | 'moreMenu'
    | 'link'
    | 'custom';

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnDef<T = any> {
    id: string;
    header: string;
    accessor?: keyof T | ((row: T) => any);
    type?: CellType;
    sortable?: boolean;
    disabled?: boolean; // Disabled header state
    helpTooltip?: string; // Help icon tooltip
    width?: string;
    minWidth?: string;
    maxWidth?: string;
    align?: 'left' | 'center' | 'right';
    
    // For text with supporting
    supportingField?: string;
    
    // For badge/status cells
    statusColor?: (value: any, row: T) => BadgeColor;
    
    // For avatar cells
    avatarField?: string;
    nameField?: string;
    emailField?: string;
    
    // For multiBadge / multiTag cells
    badgesField?: string;
    tagsField?: string;
    maxItems?: number;
    
    // For chip cell
    dotColor?: string;
    countField?: string;
    
    // For file cell
    fileIconColor?: string;
    
    // For progress cell
    progressField?: string;
    showProgressValue?: boolean;
    
    // For toggle cell
    toggleField?: string;
    onToggle?: (row: T, newValue: boolean) => void;
    
    // For usageIndicators cell
    usageFields?: { label: string; field: string; thresholds?: { warning: number; danger: number } }[];
    
    // For pin cell
    pinField?: string;
    onPin?: (row: T, newValue: boolean) => void;
    
    // For moreMenu cell
    menuActions?: ActionDef<T>[];
    
    // For action cells
    actions?: ActionDef<T>[];
    
    // For custom render
    render?: (value: any, row: T, rowIndex: number) => any;
}

export interface ActionDef<T = any> {
    id: string;
    label?: string;
    icon?: any;
    variant?: 'filled' | 'outline' | 'text' | 'ghost';
    color?: 'primary' | 'gray' | 'danger';
    onClick?: (row: T) => void;
    disabled?: (row: T) => boolean;
    hidden?: (row: T) => boolean;
    tooltip?: string;
}

export interface PaginationState {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface SortState {
    field: string | null;
    direction: SortDirection;
}

// Card Types
export type CardVariant = 'default' | 'outlined' | 'elevated' | 'filled';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

// Modal Types
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
export type ModalType = 'default' | 'info' | 'warning' | 'error';

// Breadcrumbs Types
export type BreadcrumbDivider = 'slash' | 'chevron';
export interface BreadcrumbItem {
    label: string;
    href?: string;
    icon?: any;
}

// FileUpload Types
export type FileUploadState = 'default' | 'error';
export type FileItemState = 'ongoing' | 'failed' | 'success' | 'disabled' | 'view' | 'download';
export interface UploadedFile {
    id: string;
    name: string;
    size?: number;
    progress?: number;
    state: FileItemState;
    errorMessage?: string;
    url?: string;
}

// Dropdown Types
export type DropdownOptionType = 'none' | 'icon' | 'checkbox' | 'radio' | 'toggle';
export interface DropdownOption {
    id: string;
    label: string;
    supportingText?: string;
    type?: DropdownOptionType;
    icon?: any;
    avatar?: string;
    avatarName?: string;
    showOnlineIndicator?: boolean;
    checked?: boolean;
    disabled?: boolean;
    shortcut?: string;
}

// ProgressBar Types
export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarColor = 'gray' | 'primary' | 'success' | 'warning' | 'error';

// Tab Types
export type TabType = 'button' | 'underline' | 'underline-filled';
export type TabSize = 'sm' | 'md';
export type TabState = 'default' | 'hover' | 'focus';
export interface TabItem {
    id: string;
    label: string;
    badge?: number | null;
    disabled?: boolean;
}

// Verification Code Input Types
export type VerificationCodeSize = 'sm' | 'md' | 'lg';
export type VerificationCodeDigits = 4 | 6;

// Divider Types
export type DividerOrientation = 'horizontal' | 'vertical';

// Tooltip Types
export type TooltipTheme = 'light' | 'dark';
export type TooltipArrow = 
    | 'none' 
    | 'top' 
    | 'top-left' 
    | 'top-right' 
    | 'bottom' 
    | 'bottom-left' 
    | 'bottom-right' 
    | 'left' 
    | 'right';
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

// Alert Types
export type AlertSeverity = 'info' | 'success' | 'warning' | 'error';
export type AlertVariant = 'outline' | 'filled';

// TopNavigation Types
export type TopNavStyle = 'main' | 'page';
export type TopNavMode = 'light' | 'dark';
export interface UserInfo {
    name?: string;
    email: string;
    role: string;
    avatarUrl?: string;
    initials?: string;
}

// Sidebar Types
export type SidebarApp = 'device' | 'radar';
export interface NavItem {
    id: string;
    label: string;
    icon?: any;
    href?: string;
    badge?: number | string;
    children?: NavItem[];
    dividerAfter?: boolean;
}
export interface SidebarSection {
    id: string;
    items: NavItem[];
}

// ActionMenu Types
export interface ActionMenuItem {
    id: string;
    label: string;
    icon?: any;
    destructive?: boolean;
    disabled?: boolean;
    dividerAfter?: boolean;
}

// ColumnFilter Types
export interface FilterOption {
    value: string;
    label: string;
    count?: number;
}

// BulkActionsBar Types
export interface BulkAction {
    id: string;
    label: string;
    icon?: any;
    destructive?: boolean;
    disabled?: boolean;
}
