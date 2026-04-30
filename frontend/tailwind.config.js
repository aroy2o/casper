/** @type {import('tailwindcss').Config} */
export default {
	darkMode: "class",
	content: ["./index.html", "./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				casper: {
					blue: "#185FA5",
					red: "#E24B4A",
					amber: "#EF9F27",
					green: "#1D9E75"
				}
			}
		}
	},
	plugins: []
};
