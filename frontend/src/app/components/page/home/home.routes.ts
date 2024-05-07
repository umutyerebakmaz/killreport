import { Routes } from '@angular/router';
export const HOME_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('@page/home/home.component').then(c => c.HomeComponent),
        data: {
            title: 'HOME',
        },
    },
];
