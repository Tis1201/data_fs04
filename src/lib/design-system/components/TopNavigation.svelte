<script context="module" lang="ts">
	export type TopNavStyle = 'main' | 'page';
	export type TopNavMode = 'light' | 'dark';
	
	export interface UserInfo {
		name?: string;
		email: string;
		role: string;
		avatarUrl?: string;
		initials?: string;
	}
</script>

<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Search, Bell, ChevronDown, ChevronLeft, Grip, Monitor, Radio } from 'lucide-svelte';
	import Divider from './Divider.svelte';
	import { Avatar } from '$lib/design-system/components';
	// TODO: Refactor để dùng ActionMenu component khi external trigger support hoàn thiện
	// import { ActionMenu } from '$lib/design-system/components';
	// import type { ActionMenuItem } from '$lib/design-system/components';
	
	export let style: TopNavStyle = 'main';
	export let mode: TopNavMode = 'light';
	
	// Main header (style 1)
	export let logoText: string = 'Data Realities';
	export let logoSrc: string | undefined = undefined;
	export let showSearch: boolean = true;
	export let showNotifications: boolean = true;
	
	// Page header (style 2)
	export let title: string = '';
	export let subtitle: string = '';
	export let showBackButton: boolean = true;
	
	// User info
	export let user: UserInfo | undefined = undefined;
	export let showUserMenu: boolean = true;
	
	// Additional elements for style 2
	export let showDivider: boolean = true;
	export let showGridButton: boolean = true;
	
	// Notification count
	export let notificationCount: number = 0;
	
	// User dropdown menu (built-in default; can be overridden by consumers)
	export let userMenuItems: Array<{
		id: string;
		label: string;
		destructive?: boolean;
	}> = [
		{ id: 'profile', label: 'Profile' },
		{ id: 'logout', label: 'Logout', destructive: true }
	];
	
	const dispatch = createEventDispatcher<{
		search: void;
		notifications: void;
		userMenuClick: void;
		userMenuAction: { id: string };
		back: void;
		gridClick: void;
	}>();
	
	// TODO: Uncomment when ActionMenu external trigger is fully supported
	// function handleActionMenuSelect(event: CustomEvent<ActionMenuItem>) {
	// 	const item = event.detail;
	// 	handleUserMenuAction(item.id);
	// }
	
	// Colors based on mode
	$: containerBg = mode === 'light' ? '#FFFFFF' : '#141414';
	$: borderColor = mode === 'light' ? '#E5E5E5' : '#30374F';
	$: logoColor = mode === 'light' ? '#164070' : '#F3F4F6';
	$: iconColor = mode === 'light' ? '#424242' : '#A3A3A3';
	$: chevronColor = mode === 'light' ? '#292929' : '#A3A3A3';
	$: emailColor = mode === 'light' ? '#475467' : '#B9C0D4';
	$: roleColor = mode === 'light' ? '#344054' : '#EFF1F5';
	$: titleColor = mode === 'light' ? '#292929' : '#EFF1F5';
	$: subtitleColor = mode === 'light' ? '#737373' : '#7D89B0';
	
	// Icon button styles based on mode
	$: iconButtonClasses = mode === 'light' 
		? 'bg-white border border-[#D6D6D6] shadow-[0px_1px_2px_rgba(16,24,40,0.05)]' 
		: 'bg-transparent';
	
	// Avatar gradient based on mode - exact từ Figma
	$: avatarGradient = mode === 'light' 
		? 'linear-gradient(26.57deg, #1D2939 8.33%, #344054 91.67%)'
		: 'linear-gradient(90deg, #7F56D9 0%, #9E77ED 100%)';
	
	function handleSearch() {
		dispatch('search');
	}
	
	function handleNotifications() {
		dispatch('notifications');
	}
	
	let userMenuTriggerRef: HTMLButtonElement;
	
	function handleUserMenuClick() {
		showUserDropdown = !showUserDropdown;
		dispatch('userMenuClick');
	}
	
	function handleUserMenuAction(id: string) {
		showUserDropdown = false;
		dispatch('userMenuAction', { id });
	}
	
	function handleBack() {
		dispatch('back');
	}
	
	let showGridMenu = false;
	let showUserDropdown = false;
	
	function handleGridClick() {
		showGridMenu = !showGridMenu;
		dispatch('gridClick');
	}
	
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.grid-menu-container')) {
			showGridMenu = false;
		}
		if (!target.closest('.user-menu-container')) {
			showUserDropdown = false;
		}
	}
	
	function getUserInitials(user: UserInfo): string {
		if (user.initials) return user.initials;
		if (user.name) {
			const parts = user.name.split(' ');
			if (parts.length >= 2) {
				return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
			}
			return parts[0].substring(0, 2).toUpperCase();
		}
		return user.email.substring(0, 2).toUpperCase();
	}
</script>

<header
	class="flex flex-row items-center h-[68px] w-full box-border"
	style="background: {containerBg}; border-bottom: 1px solid {borderColor}; padding: 14px 24px; gap: 16px;"
>
	{#if style === 'main'}
		<!-- Style 1: Main Header with Logo -->
		<div class="flex items-center p-1">
			{#if logoSrc}
				<img src={logoSrc} alt={logoText} class="h-[22px]" />
			{:else}
				<span 
					class="font-semibold text-xl tracking-tight"
					style="color: {logoColor}; font-family: var(--ds-font-family-primary);"
				>
					{logoText}
				</span>
			{/if}
		</div>
		
		<!-- Spacer -->
		<div class="flex-1"></div>
		
		<!-- Search Button -->
		{#if showSearch}
			<button
				type="button"
				class="flex items-center justify-center w-10 h-10 rounded-lg transition-colors {iconButtonClasses}"
				on:click={handleSearch}
				aria-label="Search"
			>
				<Search size={20} strokeWidth={2} color={iconColor} />
			</button>
		{/if}
		
		<!-- Notifications Button -->
		{#if showNotifications}
			<button
				type="button"
				class="relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors {iconButtonClasses}"
				on:click={handleNotifications}
				aria-label="Notifications"
			>
				<Bell size={20} strokeWidth={2} color={iconColor} />
				{#if notificationCount > 0}
					<span class="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-medium text-white bg-red-500 rounded-full">
						{notificationCount > 99 ? '99+' : notificationCount}
					</span>
				{/if}
			</button>
		{/if}
		
	{:else}
		<!-- Style 2: Page Header with Back Button + Title -->
		
		<!-- Back Button (display: none theo design) -->
		{#if showBackButton}
			<button
				type="button"
				class="flex items-center justify-center w-10 h-10 rounded-lg transition-colors {iconButtonClasses}"
				style="display: none;"
				on:click={handleBack}
				aria-label="Go back"
			>
				<ChevronLeft size={20} strokeWidth={2} color={iconColor} />
			</button>
		{/if}
		
		<!-- Title Section - exact specs từ Figma -->
		<div class="flex flex-col items-start" style="width: 322px; height: 46px; gap: 2px;">
			{#if title}
				<h1 
					class="font-semibold"
					style="width: 322px; height: 24px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-semibold); font-size: var(--ds-text-lg); line-height: var(--ds-leading-lg); color: {titleColor};"
				>
					{title}
				</h1>
			{/if}
			{#if subtitle}
				<p 
					class="font-normal"
					style="width: 322px; height: 20px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: {subtitleColor};"
				>
					{subtitle}
				</p>
			{/if}
		</div>
		
		<!-- Spacer -->
		<div class="flex-1"></div>
	{/if}
	
	<!-- User Menu (common to both styles) - dùng ActionMenu component từ design-system -->
	{#if showUserMenu && user}
		<div class="user-menu-container">
			<!-- User Info Button (trigger) -->
			<button
				bind:this={userMenuTriggerRef}
				type="button"
				class="user-menu-trigger"
				on:click={handleUserMenuClick}
				aria-label="User menu"
				aria-haspopup="menu"
				aria-expanded={showUserDropdown}
			>
				<!-- Avatar - dùng Avatar component từ design-system với gradient -->
				<Avatar
					src={user.avatarUrl}
					name={user.name || user.email}
					size="sm"
					gradient={avatarGradient}
					className="user-avatar"
				/>
				
				<!-- Text and Supporting Text - exact specs từ Figma -->
				<div class="user-info">
					<span class="user-email">
						{user.email}
					</span>
					<span class="user-role">
						{user.role}
					</span>
				</div>
				
				<!-- Chevron Down -->
				<ChevronDown 
					size={20} 
					strokeWidth={2} 
					color={chevronColor}
					class="user-chevron"
				/>
			</button>

			<!-- User Dropdown - TODO: Refactor để dùng ActionMenu component khi external trigger support hoàn thiện -->
			{#if showUserDropdown}
				<div
					class="user-dropdown"
					role="menu"
					tabindex="-1"
					on:click|stopPropagation
					on:keydown|stopPropagation={(e) => {
						if (e.key === 'Escape') showUserDropdown = false;
					}}
				>
					<div class="user-dropdown-content">
						{#each userMenuItems as item (item.id)}
							<button
								type="button"
								class="user-dropdown-item"
								class:destructive={item.destructive}
								on:click={() => handleUserMenuAction(item.id)}
							>
								{item.label}
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
	
	<!-- Style 2 additional elements -->
	{#if style === 'page'}
		<!-- Divider - exact specs từ Figma -->
		{#if showDivider}
			<div class="flex items-center justify-center" style="width: 4px; height: 40px; padding: 0px 2px;">
				<div style="width: 0px; height: 40px; border-left: 1px solid {borderColor};"></div>
			</div>
		{/if}
		
		<!-- Grid Button - exact specs từ Figma -->
		{#if showGridButton}
			<div class="grid-menu-container" style="position: relative;">
				<button
					type="button"
					class="flex items-center justify-center rounded-lg bg-transparent border-0"
					style="width: 40px; height: 40px; padding: 10px; gap: 8px;"
					on:click={handleGridClick}
					aria-label="Grid menu"
				>
					<Grip size={20} strokeWidth={2} color="#026AA2" />
				</button>
				
				<!-- Grid Menu Dropdown -->
				{#if showGridMenu}
					<div
						class="absolute right-0 top-full mt-2 z-[9999]"
						style="width: 222px;"
						role="menu"
						tabindex="-1"
						on:click|stopPropagation
						on:keydown={(e) => {
							if (e.key === 'Escape') {
								showGridMenu = false;
							}
						}}
					>
						<div
							class="flex flex-col items-start bg-white rounded-lg shadow-lg border border-gray-200"
							style="padding: 12px; gap: 8px;"
						>
							<!-- Title: Switch App -->
							<h3
								class="font-semibold"
								style="width: 92px; height: 24px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-semibold); font-size: var(--ds-text-md); line-height: var(--ds-leading-md); color: var(--ds-color-gray-800);"
							>
								Switch App
							</h3>
							
							<!-- App Cards Container -->
							<div
								class="flex flex-row items-center"
								style="width: 198px; height: 95px; gap: 8px;"
							>
								<!-- Device App Card -->
								<button
									type="button"
									class="flex flex-col justify-center items-center bg-white rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
									style="width: 95px; height: 95px; padding: 16px; gap: 8px;"
									on:click={() => {
										showGridMenu = false;
										// Handle Device app switch
									}}
								>
									<Monitor size={32} strokeWidth={2} color="var(--ds-color-gray-800)" />
									<span
										class="font-medium"
										style="width: 48px; height: 20px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800);"
									>
										Device
									</span>
								</button>
								
								<!-- Radar App Card -->
								<button
									type="button"
									class="flex flex-col justify-center items-center bg-white rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
									style="width: 95px; height: 95px; padding: 16px; gap: 8px;"
									on:click={() => {
										showGridMenu = false;
										// Handle Radar app switch - will develop later
									}}
								>
									<Radio size={32} strokeWidth={2} color="var(--ds-color-gray-800)" />
									<span
										class="font-medium"
										style="width: 43px; height: 20px; font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-medium); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: var(--ds-color-gray-800);"
									>
										Radar
									</span>
								</button>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</header>

<svelte:window on:click={handleClickOutside} />

<style>
	/* User Menu Container */
	.user-menu-container {
		position: relative;
	}
	
	/* User Dropdown */
	.user-dropdown {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: var(--ds-space-2);
		z-index: 9999;
		width: 222px;
	}
	
	.user-dropdown-content {
		background: var(--ds-bg-primary);
		border-radius: var(--ds-radius-lg);
		box-shadow: var(--ds-shadow-lg);
		border: 1px solid var(--ds-border-default);
		padding: var(--ds-space-2);
	}
	
	.user-dropdown-item {
		width: 100%;
		display: flex;
		align-items: center;
		height: 40px;
		padding: var(--ds-space-2) var(--ds-space-3);
		border-radius: var(--ds-radius-lg);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s ease;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium);
		font-size: var(--ds-text-sm);
		line-height: var(--ds-leading-sm);
		color: var(--ds-color-gray-800);
		text-align: left;
	}
	
	.user-dropdown-item:hover {
		background: var(--ds-bg-tertiary);
	}
	
	.user-dropdown-item.destructive {
		color: var(--ds-color-error-600);
	}
	
	/* User Menu Trigger Button */
	.user-menu-trigger {
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: 0;
		gap: var(--ds-space-2); /* 8px */
		width: 186px;
		height: 32px;
		background: transparent;
		border: none;
		cursor: pointer;
	}
	
	.user-avatar {
		flex-shrink: 0;
	}
	
	.user-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0;
		width: 110px;
		height: 32px;
		flex: none;
	}
	
	.user-email {
		display: flex;
		align-items: center;
		width: 110px;
		height: 16px;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-regular);
		font-size: 10px;
		line-height: var(--ds-leading-xs);
		letter-spacing: 0.005em;
		color: var(--ds-color-gray-600);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: none;
	}
	
	.user-role {
		display: flex;
		align-items: center;
		width: 82px;
		height: 16px;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium);
		font-size: var(--ds-text-xs);
		line-height: var(--ds-leading-xs);
		letter-spacing: 0.01em;
		color: var(--ds-color-gray-700);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: none;
	}
	
	.user-chevron {
		display: flex;
		flex-direction: row;
		justify-content: center;
		align-items: center;
		padding: var(--ds-space-1); /* 4px */
		gap: var(--ds-space-2); /* 8px */
		width: 28px;
		height: 28px;
		border-radius: var(--ds-radius-lg); /* 8px */
		flex: none;
	}
</style>
