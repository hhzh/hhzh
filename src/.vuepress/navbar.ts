import {navbar} from "vuepress-theme-hope";

export default navbar([
    "/",
    "demo/",
    {
        text: "Java八股文",
        icon: "eight",
        link: "/home.md",
    },
    {
        text: "面试流程",
        icon: "interview",
        link: "/interview/",
    },
    {
        text: "算法",
        icon: "algo",
        link: "/algo/",
    },
    {
        text: "工具",
        icon: "tool",
        link: "/tool/",
    },
    {
        text: "关于",
        icon: "about",
        link: "/about/",
    },
]);
