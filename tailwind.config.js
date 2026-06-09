export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Refined "Peter Millar finance" palette — cream, navy, brass
        cream:   { DEFAULT: '#f3efe6', 50: '#faf8f3', 100: '#f3efe6', 200: '#e9e2d3', 300: '#ddd3bd' },
        ink:     { DEFAULT: '#1b2640', 700: '#26324f', 600: '#33415f', 400: '#5b677f' },
        navy:    { DEFAULT: '#1b2640', deep: '#141d33', soft: '#26324f' },
        brass:   { DEFAULT: '#b08d4f', light: '#c4a368', dark: '#8f7039', pale: '#e7dcc4' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
