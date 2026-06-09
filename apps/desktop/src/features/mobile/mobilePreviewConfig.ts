import {
  BellRing,
  Camera,
  FilePlus2,
  MessageCircle,
  ScanLine,
  Smartphone,
  UserPlus
} from "lucide-vue-next";
import type { Component } from "vue";

export type MobilePlatformKey = "miniProgram" | "app";

export type MobilePlatform = {
  key: MobilePlatformKey;
  label: string;
  previewTitle: string;
  shellLabel: string;
  headerCaption: string;
  primaryActionLabel: string;
  capabilities: string[];
};

export type MobileQuickAction = {
  label: string;
  icon: Component;
  description: string;
};

export const mobilePlatforms: Record<MobilePlatformKey, MobilePlatform> = {
  miniProgram: {
    key: "miniProgram",
    label: "小程序",
    previewTitle: "小程序预览",
    shellLabel: "微信小程序",
    headerCaption: "轻量端 · 家长和学生随手查看",
    primaryActionLabel: "发给家长",
    capabilities: ["查看今日课程", "拍照上传错题", "接收作业提醒", "打开学习资料"]
  },
  app: {
    key: "app",
    label: "应用",
    previewTitle: "应用预览",
    shellLabel: "C-teacher 应用",
    headerCaption: "独立应用 · 高频学习管理",
    primaryActionLabel: "同步到应用",
    capabilities: ["离线资料缓存", "系统级推送提醒", "课堂记录快录", "学习报告归档"]
  }
};

export const mobilePlatformOptions = Object.values(mobilePlatforms).map((platform) => ({
  label: platform.label,
  value: platform.key
}));

export const mobileQuickActions: Record<MobilePlatformKey, MobileQuickAction[]> = {
  miniProgram: [
    { label: "拍照传题", icon: Camera, description: "学生或家长上传错题" },
    { label: "发提醒", icon: BellRing, description: "同步课程和作业提醒" },
    { label: "发资料", icon: FilePlus2, description: "分享已分配学习资料" },
    { label: "留言", icon: MessageCircle, description: "补充课后反馈" }
  ],
  app: [
    { label: "添加学生", icon: UserPlus, description: "新建学生档案" },
    { label: "扫码导入", icon: ScanLine, description: "导入作业或讲义" },
    { label: "添加资料", icon: FilePlus2, description: "上传或登记资料" },
    { label: "端内同步", icon: Smartphone, description: "推送到学生端 App" }
  ]
};
