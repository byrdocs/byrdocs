import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, loadEnv } from 'vite';
import { execSync } from 'child_process';
import { cloudflare } from '@cloudflare/vite-plugin';

const commitDate = execSync('git log -1 --format=%cI').toString().trimEnd();
const commitHash = execSync('git rev-parse HEAD').toString().trimEnd();
const lastCommitMessage = execSync('git show -s --format="%s"').toString().trimEnd();

process.env.VITE_GIT_COMMIT_DATE = commitDate;
process.env.VITE_GIT_COMMIT_HASH = commitHash;
process.env.VITE_GIT_LAST_COMMIT_MESSAGE = lastCommitMessage;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), cloudflare()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      global: "globalThis",
      PUBLISH_SITE_BASE_URL: JSON.stringify(env.PUBLISH_SITE_BASE_URL),
      ARCHIVE_REPO_URL: JSON.stringify(env.ARCHIVE_REPO_URL),
    },
    ssr: {
      noExternal: true,
    },
    build: {
      rollupOptions: {
        output: {
          inlineDynamicImports: false,
        },
      },
    },
  }
})
