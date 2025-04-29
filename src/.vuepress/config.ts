import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/javabaguwen/",

  lang: "zh-CN",
  title: "Java八股文网",
  description: "Java八股文网，史上最全的Java八股文网站",
  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
