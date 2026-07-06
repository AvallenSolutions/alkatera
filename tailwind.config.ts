import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './marketing/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
        data: 'var(--font-data)',
        serif: ['var(--font-serif)', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-data)', 'Consolas', 'monospace'],
        display: ['var(--font-display)', '"Space Grotesk"', 'sans-serif'],
      },
      transitionTimingFunction: {
        studio: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
        },
        'neon-lime': 'hsl(var(--neon-lime))',
        'neon-cyan': 'hsl(var(--neon-cyan))',
        'neon-purple': 'hsl(var(--neon-purple))',
        'neon-emerald': 'hsl(var(--neon-emerald))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        stone: {
          50: '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        lime: {
          50: '#f7fee7',
          100: '#ecfccb',
          200: '#d9f99d',
          300: '#bef264',
          400: '#a3e635',
          500: '#84cc16',
          600: '#65a30d',
          700: '#4d7c0f',
          800: '#3f6212',
          900: '#365314',
          950: '#1a2e05',
        },
        'brand-accent': '#205E40',
        /* Whitelabel tenant tokens. Resolved from CSS variables so the
           server layout can override them per procurement / distributor
           organisation. Defaults (see app/globals.css) match the
           distributor portal's sky-400 / sky-500 accent. */
        'brand-primary': 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
        'brand-strong': 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
        'brand-on': 'rgb(var(--brand-on-primary-rgb) / <alpha-value>)',
        /* The studio design language (app-wide on the redesign branch).
           Namespaced tokens; see components/studio/theme.ts. */
        studio: {
          paper: '#ECEAE3',
          cream: '#F2F1EA',
          hairline: '#D9D6CB',
          dim: '#6F6F68',
          ink: '#1A1B1D',
          forest: '#205E40',
          cobalt: '#2B46C0',
          ochre: '#DFA32B',
          'ochre-ink': '#A97C14',
          brick: '#BF4B2A',
          good: '#047857',
          attention: '#B45309',
          stale: '#BE123C',
          hold: '#6D28D9',
        },
        /* The current room's colours; set via --room-*-rgb by each room
           layout. `room` is the saturated band/poster ink, `room-accent`
           its text form on paper (ochre swaps to a darker ink), `room-on`
           the text colour on the band. */
        room: 'rgb(var(--room-rgb, 26 27 29) / <alpha-value>)',
        'room-accent': 'rgb(var(--room-accent-rgb, 26 27 29) / <alpha-value>)',
        'room-on': 'rgb(var(--room-on-rgb, 242 241 234) / <alpha-value>)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'glow-pulse': {
          '0%, 100%': {
            opacity: '1',
            boxShadow: '0 0 20px hsla(var(--neon-lime), 0.4)',
          },
          '50%': {
            opacity: '0.7',
            boxShadow: '0 0 30px hsla(var(--neon-lime), 0.6)',
          },
        },
        'slide-in-right': {
          from: {
            transform: 'translateX(100%)',
            opacity: '0',
          },
          to: {
            transform: 'translateX(0)',
            opacity: '1',
          },
        },
        'fade-in-up': {
          from: {
            transform: 'translateY(10px)',
            opacity: '0',
          },
          to: {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        float: {
          '0%, 100%': {
            transform: 'translateY(0px) translateX(0px)',
            opacity: '0.3',
          },
          '25%': {
            transform: 'translateY(-12px) translateX(4px)',
            opacity: '0.6',
          },
          '50%': {
            transform: 'translateY(-6px) translateX(-3px)',
            opacity: '0.4',
          },
          '75%': {
            transform: 'translateY(-18px) translateX(2px)',
            opacity: '0.5',
          },
        },
        sway: {
          '0%, 100%': {
            transform: 'rotate(0deg)',
          },
          '25%': {
            transform: 'rotate(2deg)',
          },
          '75%': {
            transform: 'rotate(-2deg)',
          },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'loading-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out',
        float: 'float 6s ease-in-out infinite',
        sway: 'sway 4s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'loading-bar': 'loading-bar 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
