import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'YukiTask',
				short_name: 'YukiTask',
				description: 'シンプルなタスク管理アプリ',
				theme_color: '#4f46e5',
				background_color: '#ffffff',
				display: 'standalone',
				start_url: '/dashboard',
				scope: '/',
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			injectManifest: {
				swSrc: 'src/service-worker.ts',
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
			},
			devOptions: {
				enabled: false,
				type: 'module'
			}
		})
	]
});
