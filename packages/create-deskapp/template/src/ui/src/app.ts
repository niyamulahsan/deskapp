// ./src/ui/src/app.ts

import { createHead } from "@unhead/vue/client";
import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "@/ui/App.vue";
import faviconUrl from "@/ui/assets/images/favicon/favicon.ico";
import { GumPlugin } from "@/ui/plugins/gum.ts";
import { PulsePlugin, pulse } from "@/ui/plugins/pulse.ts";
import router from "@/ui/router/index.ts";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "@/ui/assets/scss/custom.scss";
import * as bootstrap from "bootstrap";

(window as any).bootstrap = bootstrap;

let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
if (!favicon) {
  favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
}
favicon.href = faviconUrl;

export { pulse };

const app = createApp(App);
const pinia = createPinia();
const head = createHead({
  init: [{ titleTemplate: (title) => (title ? `${title} | deskapp` : "deskapp") }]
});

app.use(pinia);
app.use(router);
app.use(head);
app.use(GumPlugin);
app.use(PulsePlugin);
app.mount("#app");
