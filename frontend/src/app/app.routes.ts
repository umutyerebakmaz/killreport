import { Routes } from '@angular/router';
import { HOME_ROUTES } from '@page/home/home.routes';
import { KILL_ROUTES } from '@page/kill/kill.routes';

export const routes: Routes = [
  ...HOME_ROUTES,
  ...KILL_ROUTES,
];
