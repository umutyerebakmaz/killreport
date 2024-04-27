import { Routes } from '@angular/router';
import { HOME_ROUTES } from '@page/home/home.routes';
import { KILL_ROUTES } from '@page/kill/kill.routes';
import { CHARACTER_ROUTES } from '@page/character/character.routes';
import { ALLIANCE_ROUTES } from '@page/alliance/alliance.routes';

export const routes: Routes = [
  ...HOME_ROUTES,
  ...KILL_ROUTES,
  ...CHARACTER_ROUTES,
  ...ALLIANCE_ROUTES,
];
