import { Component, OnInit } from '@angular/core';
import { KillTableComponent } from '@ui/kill-table/kill-table.component';
import { MostValuableKillsComponent } from '@ui/most-valuable-kills/most-valuable-kills.component';
import { PaginationComponent } from '@ui/pagination/pagination.component';
import { mostValuableKillsMockup } from '../../../mocks/mocks';
import { TopCharactersCardComponent } from "@app/components/ui/top-characters-card/top-characters-card.component";

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
    imports: [MostValuableKillsComponent, KillTableComponent, PaginationComponent, TopCharactersCardComponent],
})
export class HomeComponent implements OnInit {
    rows = [1, 2, 4, 5, 6, 7, 8, 9, 10];
    mostValuableKillsMockup = mostValuableKillsMockup;
    ngOnInit(): void {
        console.log('home component');
    }
}
