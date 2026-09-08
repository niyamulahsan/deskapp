import { createApp } from 'vue';
import App from './App.vue';
import faviconUrl from '../../icons/favicon.svg';
import { pulse, PulsePlugin } from './plugins/pulse.ts';

import "bootstrap-icons/font/bootstrap-icons.css";
import "./assets/scss/custom.scss";

let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement('link');
  favicon.rel = 'icon';
  document.head.appendChild(favicon);
}
favicon.href = faviconUrl;

export { pulse };

createApp(App).use(PulsePlugin).mount('#app');