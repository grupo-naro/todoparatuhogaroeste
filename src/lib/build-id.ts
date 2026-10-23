// Se fija al compilar (next.config.ts): identifica la versión del código desplegado.
export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'
