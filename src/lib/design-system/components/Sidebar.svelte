<script context="module" lang="ts">
	export interface NavItem {
		id: string;
		label: string;
		icon?: any;
		href?: string;
		badge?: number | string;
		children?: NavItem[];
		dividerAfter?: boolean;
	}
</script>

<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { 
		ChevronDown, 
		ChevronUp,
		ChevronRight,
		IndentDecrease,
		IndentIncrease
	} from 'lucide-svelte';
	import { Button } from '$lib/design-system/components';
	
	export let expanded: boolean = true;
	export let logoText: string = 'Data Realities';
	export let logoSrc: string = '/data-realities-logo.svg';
	
	// Main navigation items
	export let mainNavItems: NavItem[] = [];
	
	// Footer navigation items (Settings, Help)
	export let footerNavItems: NavItem[] = [];
	
	// Track expanded groups
	let expandedGroups: Set<string> = new Set();
	
	// Track flyout menu for collapsed mode
	let flyoutItem: NavItem | null = null;
	let flyoutPosition = { top: 0 };
	
	const dispatch = createEventDispatcher<{
		toggle: boolean;
		navigate: NavItem;
		itemClick: NavItem;
	}>();
	
	// Check if path is active (uses currentPath for reactivity)
	function checkPathActive(href: string | undefined, path: string): boolean {
		if (!href) return false;
		
		// Strip query string and normalize trailing slash for comparison
		const hrefPath = href.split('?')[0].replace(/\/$/, '') || '/';
		const normPath = path.replace(/\/$/, '') || '/';
		
		// Exact match
		if (normPath === hrefPath) return true;
		
		// Check if current path starts with href (for nested routes)
		if (hrefPath !== '/' && normPath.startsWith(hrefPath + '/')) return true;
		
		// Also check if path starts with hrefPath
		if (hrefPath !== '/' && normPath.startsWith(hrefPath)) return true;
		
		return false;
	}
	
	// Wrapper that uses reactive currentPath
	function isPathActive(href: string | undefined): boolean {
		return checkPathActive(href, currentPath);
	}
	
	// Check if any child is active (uses currentPath for reactivity)
	function checkHasActiveChild(item: NavItem, path: string): boolean {
		if (!item.children) return false;
		return item.children.some(child => checkPathActive(child.href, path));
	}
	
	// Wrapper that uses reactive currentPath
	function hasActiveChild(item: NavItem): boolean {
		return checkHasActiveChild(item, currentPath);
	}
	
	// Check if item should show as active (reactive to expanded state and currentPath)
	function checkItemActive(item: NavItem, isExpanded: boolean, path: string): boolean {
		// Direct link active
		if (item.href && checkPathActive(item.href, path)) return true;
		
		// In collapsed mode, parent is active if any child is active
		if (!isExpanded && checkHasActiveChild(item, path)) return true;
		
		return false;
	}
	
	// Wrapper that uses reactive currentPath
	function isItemActive(item: NavItem, isExpanded: boolean): boolean {
		return checkItemActive(item, isExpanded, currentPath);
	}
	
	// Toggle sidebar expand/collapse
	function toggleSidebar() {
		expanded = !expanded;
		flyoutItem = null;
		dispatch('toggle', expanded);
	}
	
	// Toggle group expand/collapse
	function toggleGroup(itemId: string) {
		if (expandedGroups.has(itemId)) {
			expandedGroups.delete(itemId);
		} else {
			expandedGroups.add(itemId);
		}
		expandedGroups = expandedGroups;
	}
	
	// Handle item click. For Cmd/Ctrl+click or middle-click we let the browser open in new tab.
	function handleItemClick(item: NavItem, event?: MouseEvent) {
		if (item.children && item.children.length > 0) {
			if (expanded) {
				toggleGroup(item.id);
			}
		} else if (item.href) {
			// Let browser handle: Cmd+click (metaKey), Ctrl+click (ctrlKey), middle-click (button === 1)
			if (event && (event.metaKey || event.ctrlKey || event.button !== 0)) {
				return;
			}
			if (event) {
				event.preventDefault();
			}
			dispatch('itemClick', item);
			dispatch('navigate', item);
			goto(item.href);
		}
	}
	
	// Track hover state
	let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
	let currentHoverItem: NavItem | null = null;
	
	// Handle mouse enter for collapsed mode flyout
	function handleMouseEnter(item: NavItem, event: MouseEvent) {
		if (!expanded && item.children && item.children.length > 0) {
			// Clear any pending timeout
			if (hoverTimeout) {
				clearTimeout(hoverTimeout);
				hoverTimeout = null;
			}
			
			currentHoverItem = item;
			const target = event.currentTarget as HTMLElement;
			const rect = target.getBoundingClientRect();
			flyoutPosition = { top: rect.top };
			flyoutItem = item;
		}
	}
	
	// Handle mouse leave for nav item
	function handleMouseLeave(item: NavItem) {
		if (!expanded && item.children && item.children.length > 0) {
			// Delay to allow moving to flyout
			hoverTimeout = setTimeout(() => {
				if (currentHoverItem === item) {
					flyoutItem = null;
					currentHoverItem = null;
				}
			}, 150);
		}
	}
	
	// Handle mouse enter on flyout
	function handleFlyoutMouseEnter() {
		// Clear timeout when entering flyout
		if (hoverTimeout) {
			clearTimeout(hoverTimeout);
			hoverTimeout = null;
		}
	}
	
	// Handle flyout mouse leave
	function handleFlyoutMouseLeave() {
		flyoutItem = null;
		currentHoverItem = null;
	}
	
	// Sidebar width - from Figma: expanded 336px, collapsed 80px
	$: sidebarWidth = expanded ? '336px' : '80px';
	
	// Current path for reactivity
	$: currentPath = $page.url.pathname;
	
	// Force re-render when path changes
	$: pathKey = currentPath;
	
	// Track previous path so we only auto-expand on navigation, not when user collapses a group
	let prevPath: string = '';
	
	// Initialize expanded groups based on active path
	onMount(() => {
		mainNavItems.forEach(item => {
			if (item.children && hasActiveChild(item)) {
				expandedGroups.add(item.id);
			}
		});
		expandedGroups = expandedGroups;
		prevPath = currentPath;
	});
	
	// Update expanded groups only when the route changes (user navigated), not when toggling.
	// This allows RDM Management (and any section) to stay collapsed when user clicks to close it.
	$: if (currentPath && currentPath !== prevPath) {
		prevPath = currentPath;
		mainNavItems.forEach(item => {
			if (item.children && hasActiveChild(item) && !expandedGroups.has(item.id)) {
				expandedGroups.add(item.id);
			}
		});
		expandedGroups = expandedGroups;
	}
</script>

<aside
	class="sidebar"
	class:collapsed={!expanded}
	style="width: {sidebarWidth};"
>
	<!-- Header -->
	<div class="sidebar-header">
		{#if expanded}
			<div class="header-logo-wrapper">
				<img src={logoSrc} alt={logoText} class="logo-image" />
			</div>
		{/if}
		<!-- Toggle Button - uses Button component from design-system (36x36px from Figma) -->
		<div class="header-toggle-wrapper">
			<Button
				variant="text"
				color="gray"
				size="sm"
				icon={expanded ? IndentDecrease : IndentIncrease}
				iconPosition="only"
				iconSize={20}
				iconColor="var(--ds-color-neutral-true-800)"
				on:click={toggleSidebar}
				aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
			/>
		</div>
	</div>
	
	<!-- Main Navigation -->
	<nav class="sidebar-nav">
		<ul class="nav-list">
			{#each mainNavItems as item (item.id + '-' + currentPath + '-' + expanded)}
				
				<li class="nav-item-wrapper">
					{#if item.children && item.children.length > 0}
						<!-- Parent with children -->
						{@const itemActive = checkItemActive(item, expanded, currentPath)}
						<button
							type="button"
							class="nav-item"
							class:active={itemActive}
							class:has-active-child={checkHasActiveChild(item, currentPath) && expanded}
							on:click={(e) => handleItemClick(item, e)}
							on:mouseenter={(e) => handleMouseEnter(item, e)}
							on:mouseleave={() => handleMouseLeave(item)}
						>
							<div class="nav-item-icon">
								{#if item.icon}
									<svelte:component 
										this={item.icon} 
										size={24} 
										strokeWidth={2} 
										color={itemActive ? 'var(--ds-color-neutral-true-25)' : 'var(--ds-color-neutral-true-400)'}
									/>
								{/if}
							</div>
							{#if expanded}
								<span class="nav-item-label">{item.label}</span>
								<div class="nav-item-chevron">
									{#if expandedGroups.has(item.id)}
										<ChevronUp size={20} strokeWidth={2} color="var(--ds-color-neutral-true-500)" />
									{:else}
										<ChevronDown size={20} strokeWidth={2} color="var(--ds-color-neutral-true-500)" />
									{/if}
								</div>
							{:else}
								<div class="nav-item-chevron-collapsed">
									<ChevronRight size={16} strokeWidth={2} color={itemActive ? 'var(--ds-color-neutral-true-25)' : 'var(--ds-color-neutral-true-500)'} />
								</div>
							{/if}
						</button>
						
						<!-- Children (expanded mode) -->
						{#if expanded && expandedGroups.has(item.id)}
							<ul class="sub-nav">
								{#each item.children as child}
									<li>
										<a
											href={child.href}
											class="sub-nav-item"
											class:active={checkPathActive(child.href, currentPath)}
											on:click={(e) => handleItemClick(child, e)}
										>
											<span class="sub-nav-label">{child.label}</span>
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					{:else}
						<!-- Direct link -->
						{@const itemActive = checkItemActive(item, expanded, currentPath)}
						<a
							href={item.href}
							class="nav-item"
							class:active={itemActive}
							on:click={(e) => handleItemClick(item, e)}
						>
							<div class="nav-item-icon">
								{#if item.icon}
									<svelte:component 
										this={item.icon} 
										size={24} 
										strokeWidth={2} 
										color={itemActive ? 'var(--ds-color-neutral-true-25)' : 'var(--ds-color-neutral-true-400)'}
									/>
								{/if}
							</div>
							{#if expanded}
								<span class="nav-item-label">{item.label}</span>
							{/if}
						</a>
					{/if}
				</li>
				
				<!-- Divider after item -->
				{#if item.dividerAfter}
					<li class="section-divider" class:collapsed={!expanded}>
						<div class="divider-line"></div>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>
	
	<!-- Footer Navigation -->
	<!-- <div class="sidebar-footer">
		<div class="footer-divider" class:collapsed={!expanded}></div>
		<ul class="nav-list footer-nav">
			{#each footerNavItems as item (item.id + '-' + currentPath + '-' + expanded)}
				{@const itemActive = checkItemActive(item, expanded, currentPath)}
				<li class="nav-item-wrapper">
					<a
						href={item.href}
						class="nav-item"
						class:active={itemActive}
						on:click={(e) => handleItemClick(item, e)}
					>
						<div class="nav-item-icon">
							{#if item.icon}
								<svelte:component 
									this={item.icon} 
									size={20} 
									strokeWidth={2} 
									color={itemActive ? 'var(--ds-color-white)' : 'var(--ds-color-gray-400)'}
								/>
							{/if}
						</div>
						{#if expanded}
							<span class="nav-item-label">{item.label}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</div> -->
</aside>

<!-- Flyout Menu (collapsed mode) -->
{#if !expanded && flyoutItem && flyoutItem.children}
	<div 
		class="flyout-menu"
		style="top: {flyoutPosition.top}px;"
		on:mouseenter={handleFlyoutMouseEnter}
		on:mouseleave={handleFlyoutMouseLeave}
		role="menu"
	>
		<ul class="flyout-list">
			{#each flyoutItem.children as child}
				<li>
					<a
						href={child.href}
						class="flyout-item"
						class:active={checkPathActive(child.href, currentPath)}
						on:click={(e) => { handleItemClick(child, e); if (!e.metaKey && !e.ctrlKey && e.button === 0) flyoutItem = null; }}
						role="menuitem"
					>
						{child.label}
					</a>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	/* Sidebar Container */
	.sidebar {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--ds-bg-primary); /* #FFFFFF */
		border-right: 1px solid var(--ds-color-neutral-true-200); /* #E5E5E5 - from Figma */
		transition: width 0.2s ease;
		position: relative;
		box-sizing: border-box;
	}
	
	/* Header - from Figma: padding 16px, height 68px */
	.sidebar-header {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		padding: var(--ds-space-4); /* 16px */
		height: 68px;
		min-height: 68px;
		border-bottom: 1px solid var(--ds-color-neutral-true-200); /* #E5E5E5 */
		gap: var(--ds-space-4); /* 16px - gap between logo and button */
		overflow: hidden; /* Prevent button from overflowing */
		box-sizing: border-box;
		position: relative;
	}
	
	.sidebar.collapsed .sidebar-header {
		justify-content: center;
		padding: var(--ds-space-4); /* 16px all sides */
		gap: 0; /* No gap when collapsed */
	}
	
	.header-logo-wrapper {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		min-width: 0; /* Allow shrinking */
	}
	
	.header-toggle-wrapper {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.logo-image {
		width: 186px; /* From Figma */
		height: 20px; /* From Figma: 19.89px ≈ 20px */
		flex-shrink: 0;
		object-fit: contain;
		max-width: 100%;
	}
	
	/* Navigation - from Figma: padding 16px 8px, gap 8px */
	.sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: var(--ds-space-4) var(--ds-space-2); /* 16px 8px */
	}
	
	.nav-list {
		display: flex;
		flex-direction: column;
		gap: var(--ds-space-2); /* 8px */
		list-style: none;
		margin: 0;
		padding: 0;
	}
	
	/* Section Divider - from Figma: padding 2px 0px, border 1px solid #E5E5E5 */
	.section-divider {
		padding: var(--ds-space-0-5) 0; /* 2px */
	}
	
	.section-divider.collapsed {
		padding: var(--ds-space-0-5) var(--ds-space-2);
	}
	
	.divider-line {
		width: 100%;
		height: 0;
		border: 1px solid var(--ds-color-neutral-true-200); /* #E5E5E5 */
	}
	
	/* Nav Item */
	.nav-item-wrapper {
		position: relative;
	}
	
	.nav-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: var(--ds-space-2) var(--ds-space-3); /* 8px 12px - from Figma */
		gap: var(--ds-space-2); /* 8px - from Figma */
		width: 100%;
		min-height: 40px; /* From Figma */
		height: 40px;
		background: var(--ds-bg-primary);
		border-radius: var(--ds-radius-lg); /* 8px - from Figma */
		border: none;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease;
	}
	
	.sidebar.collapsed .nav-item {
		padding: 10px;
		justify-content: center;
		gap: var(--ds-spacing-1);
	}
	
	.nav-item:hover {
		background: var(--ds-color-blue-light-50);
	}
	
	.nav-item.active {
		background: var(--ds-color-navy); /* #164070 - from Figma Base/Navy */
	}
	
	.nav-item.active:hover {
		background: var(--ds-color-navy); /* Keep same on hover */
	}
	
	/* Parent with active child in expanded mode - no active state */
	.nav-item.has-active-child {
		background: var(--ds-bg-primary);
	}
	
	.nav-item.has-active-child:hover {
		background: var(--ds-color-blue-light-50);
	}
	
	.nav-item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		flex-shrink: 0;
	}
	
	.nav-item-label {
		flex: 1;
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium); /* 500 - from Figma */
		font-size: var(--ds-text-sm); /* 14px */
		line-height: var(--ds-leading-sm); /* 20px */
		color: var(--ds-color-neutral-true-700); /* #424242 - from Figma */
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	
	.nav-item.active .nav-item-label {
		color: var(--ds-color-neutral-true-25); /* #FCFCFC - from Figma */
	}
	
	.nav-item-chevron {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	
	.nav-item-chevron-collapsed {
		display: flex;
		align-items: center;
		justify-content: center;
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
	}
	
	/* Sub Navigation - from Figma: gap 0px (items adjacent) */
	.sub-nav {
		display: flex;
		flex-direction: column;
		gap: 0;
		padding: 0;
		margin: 0;
		list-style: none;
	}
	
	.sub-nav-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		padding: var(--ds-space-2) var(--ds-space-3) var(--ds-space-2) 48px; /* 8px 12px 8px 48px - from Figma */
		width: 100%;
		min-height: 40px;
		height: 40px;
		background: var(--ds-bg-primary);
		border-radius: var(--ds-radius-lg); /* 8px */
		cursor: pointer;
		text-decoration: none;
		transition: background 0.15s ease;
	}
	
	.sub-nav-item:hover {
		background: var(--ds-color-blue-light-50);
	}
	
	.sub-nav-item.active {
		background: var(--ds-color-navy); /* #164070 - from Figma */
	}
	
	.sub-nav-label {
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium); /* 500 - from Figma */
		font-size: var(--ds-text-sm); /* 14px */
		line-height: var(--ds-leading-sm); /* 20px */
		color: var(--ds-color-neutral-true-700); /* #424242 - from Figma */
	}
	
	.sub-nav-item.active .sub-nav-label {
		color: var(--ds-color-neutral-true-25); /* #FCFCFC - from Figma */
		font-weight: var(--ds-font-medium);
	}
	
	/* Footer - from Figma: padding 16px, gap 16px */
	.sidebar-footer {
		padding: var(--ds-space-4); /* 16px */
	}
	
	.footer-divider {
		height: 1px;
		background: var(--ds-color-neutral-true-200); /* #E5E5E5 */
		margin-bottom: var(--ds-space-4); /* 16px */
	}
	
	.footer-divider.collapsed {
		margin: 0 var(--ds-space-1) var(--ds-space-4);
	}
	
	.footer-nav {
		gap: var(--ds-space-4); /* 16px - from Figma */
	}
	
	/* Flyout Menu */
	.flyout-menu {
		position: fixed;
		left: 80px;
		background: var(--ds-bg-primary);
		border: 1px solid var(--ds-border-default);
		border-radius: var(--ds-radius-xl);
		box-shadow: var(--ds-shadow-lg);
		padding: var(--ds-spacing-2);
		min-width: 180px;
		z-index: 1000;
	}
	
	.flyout-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		list-style: none;
		margin: 0;
		padding: 0;
	}
	
	.flyout-item {
		display: flex;
		align-items: center;
		padding: var(--ds-space-2) var(--ds-space-3); /* 8px 12px */
		width: 100%;
		min-height: 40px;
		height: 40px;
		border-radius: var(--ds-radius-lg); /* 8px */
		font-family: var(--ds-font-family-primary);
		font-weight: var(--ds-font-medium); /* 500 */
		font-size: var(--ds-text-sm); /* 14px */
		line-height: var(--ds-leading-sm); /* 20px */
		color: var(--ds-color-neutral-true-700); /* #424242 */
		text-decoration: none;
		transition: background 0.15s ease;
		cursor: pointer;
		box-sizing: border-box;
	}
	
	.flyout-item:hover {
		background: var(--ds-color-blue-light-50);
	}
	
	.flyout-item.active {
		background: var(--ds-color-navy); /* #164070 - from Figma */
		color: var(--ds-color-neutral-true-25); /* #FCFCFC - from Figma */
		font-weight: var(--ds-font-medium);
	}
</style>
