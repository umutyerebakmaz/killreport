import { Routes } from '@angular/router';
import { HOME_ROUTES } from '@page/home/home.routes';
import { KILL_ROUTES } from '@page/kill/kill.routes';
import { CHARACTER_ROUTES } from './components/pages/character/character.routes';

export const routes: Routes = [...HOME_ROUTES, ...KILL_ROUTES, ...CHARACTER_ROUTES];
