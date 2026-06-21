import blueBoy from "../../assets/avatars/blue-boy.png";
import blueGirl from "../../assets/avatars/blue-girl.png";
import nightBoy from "../../assets/avatars/night-boy.png";
import nightGirl from "../../assets/avatars/night-girl.png";
import plumBoy from "../../assets/avatars/plum-boy.png";
import plumGirl from "../../assets/avatars/plum-girl.png";
import turquoiseBoy from "../../assets/avatars/turquoise-boy.png";
import turquoiseGirl from "../../assets/avatars/turquoise-girl.png";
import type { AppThemeKey, Child } from "../../features/children/childStore";

export type StudentAvatarKey = `${AppThemeKey}-${"boy" | "girl"}`;

export type StudentAvatarOption = {
  key: StudentAvatarKey;
  themeKey: AppThemeKey;
  gender: Child["gender"];
  label: string;
  src: string;
};

export const childAvatarOptions: StudentAvatarOption[] = [
  { key: "turquoise-boy", themeKey: "turquoise", gender: "male", label: "松石男孩", src: turquoiseBoy },
  { key: "turquoise-girl", themeKey: "turquoise", gender: "female", label: "松石女孩", src: turquoiseGirl },
  { key: "night-boy", themeKey: "night", gender: "male", label: "夜读男孩", src: nightBoy },
  { key: "night-girl", themeKey: "night", gender: "female", label: "夜读女孩", src: nightGirl },
  { key: "blue-boy", themeKey: "blue", gender: "male", label: "晴蓝男孩", src: blueBoy },
  { key: "blue-girl", themeKey: "blue", gender: "female", label: "晴蓝女孩", src: blueGirl },
  { key: "plum-boy", themeKey: "plum", gender: "male", label: "梅紫男孩", src: plumBoy },
  { key: "plum-girl", themeKey: "plum", gender: "female", label: "梅紫女孩", src: plumGirl }
];

export const childAvatarSources = Object.fromEntries(
  childAvatarOptions.map((avatar) => [avatar.key, avatar.src])
) as Record<StudentAvatarKey, string>;

export function childAvatarSourceFor(themeKey: AppThemeKey, gender: Child["gender"]) {
  const suffix = gender === "male" ? "boy" : "girl";
  return childAvatarSources[`${themeKey}-${suffix}`];
}
