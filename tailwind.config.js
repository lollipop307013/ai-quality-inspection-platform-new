import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  // 只扫描迁移过来的旧平台页面与组件，避免影响其余原型页面
  content: [
    './src/pages/qc/**/*.{ts,tsx}',
    './src/components/ui/**/*.{ts,tsx}',
    './src/components/export-result-dialog.tsx',
    './src/components/task-creation-dialog-new.tsx',
  ],
  // 不生成 Preflight 基础重置样式，避免影响框架自身的 antd/TDesign 组件与 AppShell
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--legacy-background))',
        foreground: 'hsl(var(--legacy-foreground))',
        card: {
          DEFAULT: 'hsl(var(--legacy-card))',
          foreground: 'hsl(var(--legacy-card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--legacy-popover))',
          foreground: 'hsl(var(--legacy-popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--legacy-primary))',
          foreground: 'hsl(var(--legacy-primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--legacy-secondary))',
          foreground: 'hsl(var(--legacy-secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--legacy-muted))',
          foreground: 'hsl(var(--legacy-muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--legacy-accent))',
          foreground: 'hsl(var(--legacy-accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--legacy-destructive))',
          foreground: 'hsl(var(--legacy-destructive-foreground))',
        },
        border: 'hsl(var(--legacy-border))',
        input: 'hsl(var(--legacy-input))',
        ring: 'hsl(var(--legacy-ring))',
      },
      borderRadius: {
        lg: 'var(--legacy-radius)',
        md: 'calc(var(--legacy-radius) - 2px)',
        sm: 'calc(var(--legacy-radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
