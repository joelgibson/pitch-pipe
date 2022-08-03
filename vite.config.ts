import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        svelte(),
        VitePWA({
            // Turn on the service worker. It will just "do the right thing" for simple builds.
            registerType: 'autoUpdate',
            manifest: {
                name: "Pitch pipe",
                short_name: "Pitch pipe",
                description: "A pitch pipe, with a frequency analyser and justly-tuned intervals.",
                theme_color: "#1F2937",
                icons: [
                    {
                        src: 'src/icon/icon-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'src/icon/icon-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    }
                ]
            }
        }),
    ],

    // An empty base string makes the build use relative paths when pushed to a server.
    base: '',
})
