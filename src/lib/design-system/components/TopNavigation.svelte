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
	import { Search, Bell, ChevronDown, ChevronLeft, Grip, Monitor, Radio, User, LogOut } from 'lucide-svelte';
	import Divider from './Divider.svelte';
	import { Avatar } from '$lib/design-system/components';
	// TODO: Refactor to use ActionMenu component when external trigger support is complete
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

	// Switch Account section (optional – shown inside user dropdown when provided)
	export let accountMemberships: Array<{
		id: string;
		role?: string;
		account?: { id: string; name: string; slug?: string };
		name?: string;
	}> = [];
	export let currentAccount: { id: string; name?: string } | null = null;
	
	const dispatch = createEventDispatcher<{
		search: void;
		notifications: void;
		userMenuClick: void;
		userMenuAction: { id: string };
		switchAccount: { accountId: string };
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
	
	// Avatar gradient based on mode - exact from Figma
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

	function handleSwitchAccount(accountId: string) {
		dispatch('switchAccount', { accountId });
	}

	$: currentAccountId = currentAccount?.id ?? null;
	$: nonLogoutItems = userMenuItems.filter((item) => item.id !== 'logout');
	$: logoutItems = userMenuItems.filter((item) => item.id === 'logout');
	$: showSwitchSection = accountMemberships && accountMemberships.length > 0;
	
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
		
		<!-- Title Section - flex + min-width:0 để tránh tràn, subtitle truncate ellipsis -->
		<div class="flex flex-col items-start title-section" style="gap: 2px;">
			{#if title}
				<h1 
					class="font-semibold title-text"
					style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-semibold); font-size: var(--ds-text-lg); line-height: var(--ds-leading-lg); color: {titleColor};"
				>
					{title}
				</h1>
			{/if}
			{#if subtitle}
				<p 
					class="font-normal subtitle-text"
					style="font-family: var(--ds-font-family-primary); font-weight: var(--ds-font-regular); font-size: var(--ds-text-sm); line-height: var(--ds-leading-sm); color: {subtitleColor};"
				>
					{subtitle}
				</p>
			{/if}
		</div>
		
		<!-- Spacer -->
		<div class="flex-1"></div>
	{/if}
	
	<!-- User Menu (common to both styles) - uses ActionMenu component from design-system -->
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
				<!-- Avatar - uses Avatar component from design-system with gradient -->
				<Avatar
					src={user.avatarUrl}
					name={user.name || user.email}
					size="sm"
					gradient={avatarGradient}
					className="user-avatar"
				/>
				
				<!-- Text and Supporting Text - exact specs from Figma -->
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

			<!-- User Dropdown - TODO: Refactor to use ActionMenu component when external trigger support is complete -->
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
						<!-- My Profile / non-logout items (with icon) -->
						{#each nonLogoutItems as item (item.id)}
							<button
								type="button"
								class="user-dropdown-item user-dropdown-item-with-icon"
								on:click={() => handleUserMenuAction(item.id)}
							>
								<User size={16} strokeWidth={2} class="user-dropdown-icon" />
								{item.label}
							</button>
						{/each}
						<!-- Switch Account section -->
						{#if showSwitchSection}
							<div class="user-dropdown-divider" role="separator"></div>
							<div class="user-dropdown-section-label">Switch Account</div>
							{#each accountMemberships as membership (membership.id)}
								{@const accountId = membership.account?.id ?? membership.id}
								{@const accountName = membership.account?.name ?? membership.name ?? 'Unknown'}
								{@const roleLabel = membership.role ?? 'Member'}
								<button
									type="button"
									class="user-dropdown-account-option"
									class:is-selected={currentAccountId === accountId}
									on:click={() => handleSwitchAccount(accountId)}
								>
									<span class="user-dropdown-radio" aria-hidden="true">
										{#if currentAccountId === accountId}
											<span class="user-dropdown-radio-dot"></span>
										{/if}
									</span>
									<Avatar
										name={accountName}
										size="xs"
										gradient={avatarGradient}
										className="user-dropdown-account-avatar"
									/>
									<div class="user-dropdown-account-info">
										<span class="user-dropdown-account-role">{roleLabel}</span>
										<span class="user-dropdown-account-name">{accountName}</span>
									</div>
								</button>
							{/each}
							<div class="user-dropdown-divider" role="separator"></div>
						{/if}
						<!-- Sign out / logout items (with icon) -->
						{#each logoutItems as item (item.id)}
							<button
								type="button"
								class="user-dropdown-item user-dropdown-item-with-icon"
								class:destructive={item.destructive}
								on:click={() => handleUserMenuAction(item.id)}
							>
								<LogOut size={16} strokeWidth={2} class="user-dropdown-icon" />
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
		<!-- Divider - exact specs from Figma -->
		{#if showDivider}
			<div class="flex items-center justify-center" style="width: 4px; height: 40px; padding: 0px 2px;">
				<div style="width: 0px; height: 40px; border-left: 1px solid {borderColor};"></div>
			</div>
		{/if}
		
		<!-- Grid Button - exact specs from Figma -->
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
	/* Page header title section - tránh tràn, không đổi height header; co màn hình thì subtitle ellipsis, không bị user menu che */
	.title-section {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
	
	/* Cần width ràng buộc rõ thì text-overflow: ellipsis mới hiện "..." */
	.title-text,
	.subtitle-text {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: block;
	}
	
	/* User Menu Container - không co lại để title section là phần bị thu nhỏ */
	.user-menu-container {
		position: relative;
		flex-shrink: 0;
	}
	
	/* User Dropdown */
	.user-dropdown {
		position: absolute;
		right: 0;
		top: 100%;
		margin-top: var(--ds-space-2);
		z-index: 9999;
		min-width: 222px;
		width: max-content;
		max-width: 320px;
	}
	
	.user-dropdown-content {
		background: var(--ds-bg-primary);
		border-radius: var(--ds-radius-lg);
		box-shadow: var(--ds-shadow-lg);
		border: 1px solid var(--ds-border-default);
		padding: var(--ds-space-2);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	
	.user-dropdown-item {
		width: 100%;
		display: flex;
		align-items: center;
		min-height: 40px;
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
	
	.user-dropdown-item-with-icon {
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
	}
	
	.user-dropdown-icon {
		flex-shrink: 0;
		color: inherit;
	}
	
	.user-dropdown-divider {
		height: 1px;
		background: var(--ds-border-default);
		margin: var(--ds-space-1) 0;
	}
	
	.user-dropdown-section-label {
		font-family: var(--ds-font-family-primary);
		font-size: var(--ds-text-xs);
		font-weight: var(--ds-font-medium);
		color: var(--ds-color-gray-500);
		padding: var(--ds-space-1) var(--ds-space-3);
		margin-top: 2px;
	}
	
	.user-dropdown-account-option {
		display: flex;
		align-items: center;
		gap: var(--ds-space-2);
		width: 100%;
		min-height: 44px;
		padding: var(--ds-space-2) var(--ds-space-3);
		border-radius: var(--ds-radius-lg);
		background: transparent;
		border: none;
		cursor: pointer;
		transition: background-color 0.15s ease;
		text-align: left;
	}
	
	.user-dropdown-account-option:hover {
		background: var(--ds-bg-tertiary);
	}
	
	.user-dropdown-account-option.is-selected {
		background: var(--ds-bg-tertiary);
	}
	
	.user-dropdown-radio {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--ds-color-gray-400);
		background: var(--ds-bg-primary);
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.user-dropdown-account-option.is-selected .user-dropdown-radio {
		border-color: var(--ds-color-gray-800);
	}
	
	.user-dropdown-radio-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ds-color-gray-800);
	}
	
	.user-dropdown-account-avatar {
		flex-shrink: 0;
	}
	
	.user-dropdown-account-info {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		flex: 1;
	}
	
	.user-dropdown-account-role {
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium);
		font-size: var(--ds-text-sm);
		color: var(--ds-color-gray-800);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	
	.user-dropdown-account-name {
		font-family: var(--ds-font-family-primary);
		font-size: var(--ds-text-xs);
		color: var(--ds-color-gray-500);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
