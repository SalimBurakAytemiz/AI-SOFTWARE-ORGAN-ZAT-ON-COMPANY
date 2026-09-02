// Tailwind CSS v4 PostCSS eklentisi. Tüm util sınıfları ve @theme token'ları
// derleme sırasında statik CSS'e çevrilir (çalışma zamanında JS gerektirmez).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
