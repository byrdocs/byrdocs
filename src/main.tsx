/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { hydrateRoot } from 'react-dom/client'

import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"

import Notfound from './pages/Notfound';
import Home from './pages/Home';
import Loading from './components/loading';
import { SsrProvider, readSsrBootstrap } from './ssr-context';

const About = lazy(() => import('./pages/About'))
const Callback = lazy(() => import('./pages/Callback'))
const Auth = lazy(() => import('./pages/Auth'))
const OAuthLogin = lazy(() => import('./pages/Login'))
const Login = lazy(() => import('./pages/FileLogin'))

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "/about",
    element: <React.Suspense fallback={<Loading />}>
      <About />
    </React.Suspense>,
  },
  {
    path: "/callback/:service?",
    element: <React.Suspense fallback={<Loading />}>
      <Callback />
    </React.Suspense>,
  },
  {
    path: "/auth/:uuid/:service?",
    element: <React.Suspense fallback={<Loading />}>
      <Auth />
    </React.Suspense>,
  },
  {
    path: "/login/:uuid/:service?",
    element: <React.Suspense fallback={<Loading />}>
      <OAuthLogin />
    </React.Suspense>,
  },
  {
    path: "/login",
    element: <React.Suspense fallback={<Loading />}>
      <Login />
    </React.Suspense>,
  },
  {
    path: "*",
    element: <Notfound />,
  }
]);

const rootElement = document.getElementById('root')!
const bootstrap = readSsrBootstrap()

const app = (
  <React.StrictMode>
    <SsrProvider value={bootstrap}>
      <ThemeProvider defaultTheme="system">
        <RouterProvider router={router} />
        <Toaster position="bottom-center" richColors={true} />
      </ThemeProvider>
    </SsrProvider>
  </React.StrictMode>
)

if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app)
} else {
  ReactDOM.createRoot(rootElement).render(app)
}
