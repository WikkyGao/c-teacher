import { createApp } from "vue";
import { createPinia } from "pinia";
import naive from "naive-ui";
import App from "./app/App.vue";
import "./shared/styles/global.css";

createApp(App).use(createPinia()).use(naive).mount("#app");
