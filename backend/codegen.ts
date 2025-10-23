import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/schema/**/*.graphql',
  generates: {
    'src/generated-schema.graphql': {
      plugins: ['schema-ast'],
    },
    'src/generated-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
    },
  },
  hooks: {},
};

export default config;
