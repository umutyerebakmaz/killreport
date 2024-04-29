import { Routes } from '@angular/router';

export const CORPORATION_ROUTES: Routes = [
    {
        path: 'corporation',
        loadComponent: () => import('@page/corporation/corporation.component').then(c => c.CorporationComponent),
        data: {
            title: 'Corporation',
        },
    },
];
