import { Routes } from '@angular/router';

export const KILL_ROUTES: Routes = [
    {
        path: 'kill',
        loadComponent: () => import('@page/kill/kill.component').then(c => c.KillComponent),
        data: {
            title: 'KILL',
        },
    },
];
