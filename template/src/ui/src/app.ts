import { createApp } from 'vue';
import App from '@/ui/App.vue';
import faviconUrl from '@/ui/assets/images/favicon/favicon.ico';
import { pulse, PulsePlugin } from '@/ui/plugins/pulse.ts';

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "@/ui/assets/scss/custom.scss";

let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement('link');
  favicon.rel = 'icon';
  document.head.appendChild(favicon);
}
favicon.href = faviconUrl;

export { pulse };

createApp(App).use(PulsePlugin).mount('#app');