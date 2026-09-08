import tseslint from 'typescript-eslint';
export default tseslint.config({ignores:['**/node_modules/**','**/.next/**','**/dist/**','**/expo-env.d.ts','**/next-env.d.ts']}, ...tseslint.configs.recommended, {rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'@typescript-eslint/no-explicit-any':'error'}});
