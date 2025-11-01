import { CharacterResolvers, MutationResolvers, QueryResolvers } from '../generated-types';

// Mock data - internal type için userId ekliyoruz
type CharacterWithUserId = {
    id: string;
    name: string;
    corporation: string | null;
    alliance: string | null;
    securityStatus: number | null;
    userId: string;
};

const characters: CharacterWithUserId[] = [
    {
        id: '1',
        name: 'Captain Awesome',
        corporation: 'Test Corp',
        alliance: 'Test Alliance',
        securityStatus: 5.0,
        userId: '1'
    },
    {
        id: '2',
        name: 'Pirate Pete',
        corporation: 'Evil Corp',
        alliance: null,
        securityStatus: -10.0,
        userId: '2'
    },
];

// Query Resolvers
export const characterQueries: QueryResolvers = {
    character: (_, { id }) => {
        const character = characters.find(c => c.id === id);
        return character || null;
    },

    charactersByUser: (_, { userId }) => {
        return characters.filter(c => c.userId === userId);
    },
};

// Mutation Resolvers
export const characterMutations: MutationResolvers = {
    addCharacter: (_, { input }) => {
        const newCharacter = {
            id: String(characters.length + 1),
            name: input.name,
            corporation: input.corporation || null,
            alliance: null,
            securityStatus: 0,
            userId: input.userId,
        };
        characters.push(newCharacter);
        return {
            character: newCharacter,
            clientMutationId: input.clientMutationId || null,
        };
    },
};

// Field Resolvers - for Character type fields
export const characterFieldResolvers: CharacterResolvers = {
    user: (parent) => {
        // Find userId from internal data using parent character
        // In real project, user relation would be fetched from database using parent.id
        const characterData = characters.find(c => c.id === parent.id);
        if (!characterData) return null;

        return {
            id: characterData.userId,
            name: 'User Name',
            email: 'user@example.com',
            createdAt: new Date().toISOString(),
        };
    },
};
