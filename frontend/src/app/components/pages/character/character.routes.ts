import { Routes } from '@angular/router';

export const CHARACTER_ROUTES: Routes = [
    {
        path: 'character',
        loadComponent: () =>
            import('@page/character/character.component').then(
                c => c.CharacterComponent
            ),
        data: {
            title: 'CHARACTER',
        },
    },
];
