import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  server: {
    // H5 开发兜底：config.ts 会把未配置的 API_BASE 落到「当前 origin + /api」，
    // 由 dev server 代理转发到本地后端；手机局域网访问本机 dev server 时同样生效。
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
