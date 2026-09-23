import localFont from "next/font/local";
import { Noto_Naskh_Arabic, Noto_Sans_Arabic } from "next/font/google";

export const questa = localFont({
  src: "../brand/Font/questa-webfont/2-Questa_Regular.woff",
  weight: "400",
  style: "normal",
  variable: "--font-questa",
  display: "swap",
});

export const lato = localFont({
  src: [
    {
      path: "../brand/Font/lato/Lato-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../brand/Font/lato/Lato-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../brand/Font/lato/Lato-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-lato",
  display: "swap",
});

export const notoNaskh = Noto_Naskh_Arabic({
  weight: "400",
  subsets: ["arabic"],
  variable: "--font-noto-naskh",
  display: "swap",
});

export const notoSans = Noto_Sans_Arabic({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-noto-sans",
  display: "swap",
});
