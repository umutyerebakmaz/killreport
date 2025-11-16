import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: '../backend/src/generated-schema.graphql',
    documents: ['src/**/*.graphql'],
    ignoreNoDocuments: true,
    generates: {
        './src/generated/graphql.ts': {
            plugins: [
                'typescript',
                'typescript-operations',
                'typescript-react-apollo',
            ],
        },
    },
};

export default config;
