export * from "./utils";
export * from "./framer-motion";
export * from "./next-themes";
export * as merge from "deepmerge";

export const IMAGE_PLACEHOLDER = {
  logo: "https://placehold.co/250x250/27272a/FFF",
  image: "https://placehold.co/500x500/27272a/FFF",
  banner: "https://placehold.co/1500x500/27272a/FFF",
};

export const dynamicPlaceholder = (
  width = 250,
  height = 250,
  color = "#27272a",
  contrast = "#FFFFFF"
) =>
  `https://placehold.co/${width}x${height}/${color?.replace(
    "#",
    ""
  )}/${contrast?.replace("#", "")}`;
