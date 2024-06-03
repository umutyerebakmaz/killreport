import { Routes } from '@angular/router';

export const ALLIANCE_ROUTES: Routes = [
    {
        path: 'alliance',
        loadComponent: () => import('@page/alliance/alliance.component').then(c => c.AllianceComponent),
        data: {
            title: 'Alliance',
        },
    },
];
