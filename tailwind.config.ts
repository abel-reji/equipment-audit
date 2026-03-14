import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#182126",
        slate: "#42545f",
        mist: "#ebf0f2",
        sand: "#f7f2e7",
        moss: "#6f7d36",
        ember: "#bd5d38"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(24, 33, 38, 0.08)"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(24,33,38,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(24,33,38,0.06) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;

