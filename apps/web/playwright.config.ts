import { defineConfig } from "@playwright/test";

/* 视觉回归配置：
   - reducedMotion: 'reduce' —— 全站动效遵循 prefers-reduced-motion，
     截图时粒子网格/count-up/滚动叙事全部静止，结果确定。
   - canvas 元素遮罩：即便如此仍遮罩，双保险。
   - 基线位于 test/visual/visual.spec.ts-snapshots/（由 CI 首跑自举并回提）。 */
export default defineConfig({
  testDir: "./test/visual",
  timeout: 45_000,
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:8310",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: "node test/visual/static-server.mjs",
    port: 8310,
    reuseExistingServer: false,
  },
  expect: {
    toHaveScreenshot: {
      /* 字体渲染在 Win/Linux 间有亚像素差；阈值只拦真实回归 */
      maxDiffPixelRatio: 0.02,
    },
  },
});
