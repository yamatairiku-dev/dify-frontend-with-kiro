/// <reference types="vite/client" />
/// <reference types="@react-router/dev/vite" />

declare module 'virtual:react-router/routes' {
  import type { RouteObject } from 'react-router';
  const routes: RouteObject[];
  export default routes;
}
