import { defineConfig } from 'vitest/config';
export default defineConfig({ test:{ environment:'node', include:['packages/**/*.test.mjs','command-center/test/**/*.test.mjs'], coverage:{provider:'v8',reporter:['text','html'],thresholds:{lines:70,functions:70}} } });
