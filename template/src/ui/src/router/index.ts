// ./src/ui/src/router/index.ts

import { createRouter, createWebHashHistory } from "vue-router";
import { setupRouteProgress } from "@/ui/plugins/routeProgress";

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
    component: () => import("@/ui/pages/dashboard/index.vue")
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

// setupRouteProgress(router);

// router.beforeEach(async (to) => {
//   const auth = useAuthStore(); // first make it into pinia store and import from there

//   if (to.meta.requiresAuth && !auth.isAuthenticated) {
//     return { path: "/login", query: { redirect: to.fullPath } };
//   }

//   if (to.meta.guestOnly && auth.isAuthenticated) {
//     return { path: "/" };
//   }

//   return true;
// });

export default router;
