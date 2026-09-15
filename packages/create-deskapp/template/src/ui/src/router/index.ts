import { createRouter, createWebHistory } from "vue-router";

/**
 * Router - one route for now, the dashboard at `/`. Route components are
 * lazy-imported from the pages folder; add routes here as your app grows:
 *
 *   { path: "/posts", name: "posts", component: () => import("@/ui/pages/posts/index.vue") }
 *
 * The backend serves the built SPA (`src/ui/dist`) for every path, so SPA
 * routes work directly inside the desktop window.
 */
export const routes = [
  {
    path: "/",
    name: "dashboard",
    component: () => import("@/ui/pages/dashboard/index.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;