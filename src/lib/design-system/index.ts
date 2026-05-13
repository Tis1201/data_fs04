// =============================================================================
// DESIGN SYSTEM - Main Export
// =============================================================================

// Re-export components
export * from './components';

// =============================================================================
// DESIGN TOKENS (TypeScript constants for programmatic access)
// =============================================================================

export const colors = {
	// Blue Light - Primary Button colors (from Figma)
	blueLight: {
		'25': '#F5FBFF',
		'50': '#F0F9FF',
		'100': '#E0F2FE',
		'200': '#B9E6FE',
		'300': '#7CD4FD',
		'400': '#36BFFA',
		'500': '#0BA5EC',
		'600': '#0086C9',
		'700': '#026AA2',
		'800': '#065986',
		'900': '#0B4A6F',
	},
	// Primary Navy
	primary: {
		'25': '#F5F8FF',
		'50': '#EFF4FF',
		'100': '#D1E0FF',
		'200': '#B2CCFF',
		'300': '#84ADFF',
		'400': '#528BFF',
		'500': '#2970FF',
		'600': '#155EEF',
		'700': '#004AEB',
		'800': '#0040C1',
		'900': '#00359E',
	},
	gray: {
		'25': '#FCFCFD',
		'50': '#F9FAFB',
		'100': '#F2F4F7',
		'200': '#EAECF0',
		'300': '#D0D5DD',
		'400': '#98A2B3',
		'500': '#667085',
		'600': '#475467',
		'700': '#344054',
		'800': '#1D2939',
		'900': '#101828',
	},
	success: {
		'25': '#F6FEF9',
		'50': '#ECFDF3',
		'100': '#D1FADF',
		'200': '#A6F4C5',
		'300': '#6CE9A6',
		'400': '#32D583',
		'500': '#12B76A',
		'600': '#039855',
		'700': '#027A48',
		'800': '#05603A',
		'900': '#054F31',
	},
	warning: {
		'25': '#FFFCF5',
		'50': '#FFFAEB',
		'100': '#FEF0C7',
		'200': '#FEDF89',
		'300': '#FEC84B',
		'400': '#FDB022',
		'500': '#F79009',
		'600': '#DC6803',
		'700': '#B54708',
		'800': '#93370D',
		'900': '#7A2E0E',
	},
	error: {
		'25': '#FFFBFA',
		'50': '#FEF3F2',
		'100': '#FEE4E2',
		'200': '#FECDCA',
		'300': '#FDA29B',
		'400': '#F97066',
		'500': '#F04438',
		'600': '#D92D20',
		'700': '#B42318',
		'800': '#912018',
		'900': '#7A271A',
	},
	white: '#FFFFFF',
	black: '#000000',
};

export const typography = {
	fontFamily: {
		base: "'Poppins', sans-serif",
	},
	fontSize: {
		xs: '0.75rem',    // 12px
		sm: '0.875rem',   // 14px
		md: '1rem',       // 16px
		lg: '1.125rem',   // 18px
		xl: '1.25rem',    // 20px
	},
	fontWeight: {
		regular: 400,
		medium: 500,
		semibold: 600,
		bold: 700,
	},
	lineHeight: {
		tight: 1.25,
		normal: 1.5,
		relaxed: 1.75,
	},
	// Display sizes from Figma
	display: {
		'2xl': { size: '4.5rem', lineHeight: '5.625rem', tracking: '-0.02em' },
		xl: { size: '3.75rem', lineHeight: '4.5rem', tracking: '-0.02em' },
		lg: { size: '3rem', lineHeight: '3.75rem', tracking: '-0.02em' },
		md: { size: '2.25rem', lineHeight: '2.75rem', tracking: '-0.02em' },
		sm: { size: '1.875rem', lineHeight: '2.375rem', tracking: '0' },
		xs: { size: '1.5rem', lineHeight: '2rem', tracking: '0' },
	},
	// Text sizes from Figma
	text: {
		xl: { size: '1.25rem', lineHeight: '1.875rem' },
		lg: { size: '1.125rem', lineHeight: '1.75rem' },
		md: { size: '1rem', lineHeight: '1.5rem' },
		sm: { size: '0.875rem', lineHeight: '1.25rem' },
		xs: { size: '0.75rem', lineHeight: '1.125rem' },
	},
};

export const spacing = {
	0: '0',
	0.5: '0.125rem',  // 2px
	1: '0.25rem',     // 4px
	1.5: '0.375rem',  // 6px
	2: '0.5rem',      // 8px
	2.5: '0.625rem',  // 10px
	3: '0.75rem',     // 12px
	3.5: '0.875rem',  // 14px
	4: '1rem',        // 16px
	5: '1.25rem',     // 20px
	6: '1.5rem',      // 24px
	7: '1.75rem',     // 28px
	8: '2rem',        // 32px
	9: '2.25rem',     // 36px
	10: '2.5rem',     // 40px
	11: '2.75rem',    // 44px
	12: '3rem',       // 48px
	14: '3.5rem',     // 56px
	16: '4rem',       // 64px
	20: '5rem',       // 80px
	24: '6rem',       // 96px
	28: '7rem',       // 112px
	32: '8rem',       // 128px
};

export const radius = {
	none: '0',
	sm: '0.125rem',   // 2px
	default: '0.25rem', // 4px
	md: '0.375rem',   // 6px
	lg: '0.5rem',     // 8px - Button radius from Figma
	xl: '0.75rem',    // 12px
	'2xl': '1rem',    // 16px
	'3xl': '1.5rem',  // 24px
	full: '9999px',
};

export const shadows = {
	xs: '0px 1px 2px rgba(16, 24, 40, 0.05)',
	sm: '0px 1px 3px rgba(16, 24, 40, 0.1), 0px 1px 2px rgba(16, 24, 40, 0.06)',
	md: '0px 4px 8px -2px rgba(16, 24, 40, 0.1), 0px 2px 4px -2px rgba(16, 24, 40, 0.06)',
	lg: '0px 12px 16px -4px rgba(16, 24, 40, 0.08), 0px 4px 6px -2px rgba(16, 24, 40, 0.03)',
	xl: '0px 20px 24px -4px rgba(16, 24, 40, 0.08), 0px 8px 8px -4px rgba(16, 24, 40, 0.03)',
	'2xl': '0px 24px 48px -12px rgba(16, 24, 40, 0.18)',
	'3xl': '0px 32px 64px -12px rgba(16, 24, 40, 0.14)',
};

// Button size specifications from Figma
export const buttonSizes = {
	sm: {
		height: '36px',
		paddingX: '14px',
		paddingY: '8px',
		gap: '8px',
		fontSize: '14px',
		lineHeight: '20px',
	},
	md: {
		height: '40px',
		paddingX: '16px',
		paddingY: '10px',
		gap: '8px',
		fontSize: '14px',
		lineHeight: '20px',
	},
	lg: {
		height: '44px',
		paddingX: '18px',
		paddingY: '10px',
		gap: '8px',
		fontSize: '14px',
		lineHeight: '20px',
	},
	xl: {
		height: '48px',
		paddingX: '20px',
		paddingY: '12px',
		gap: '8px',
		fontSize: '14px',
		lineHeight: '20px',
	},
	'2xl': {
		height: '56px',
		paddingX: '28px',
		paddingY: '16px',
		gap: '12px',
		fontSize: '14px',
		lineHeight: '20px',
	},
};

// Component Size type for generic use
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Status type for badges and alerts
export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'neutral';
