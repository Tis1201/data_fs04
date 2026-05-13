<script lang="ts">
	export let variant: 'blue' | 'green' | 'red' | 'gray' | 'yellow' | 'purple' | 'orange' = 'gray';
	export let size: 'sm' | 'md' = 'md';

	const variantClasses: Record<typeof variant, string> = {
		blue: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-700/10',
		green: 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
		red: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/10',
		gray: 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-500/10',
		yellow: 'bg-yellow-50 text-yellow-800 ring-1 ring-inset ring-yellow-600/20',
		purple: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-700/10',
		orange: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20'
	};

	const sizeClasses: Record<typeof size, string> = {
		sm: 'px-1.5 py-0.5 text-[11px]',
		md: 'px-2.5 py-0.5 text-xs'
	};
</script>

<span
	class="inline-flex items-center rounded-md font-medium {variantClasses[variant]} {sizeClasses[size]}"
>
	<slot />
</span>
