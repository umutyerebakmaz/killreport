import { Component, OnInit } from '@angular/core';
import { KillTableComponent } from '@app/components/common/kill-table/kill-table.component';
import { MostValuableKillsComponent } from '@app/components/common/most-valuable-kills/most-valuable-kills.component';
import { PaginationComponent } from '@app/components/common/pagination/pagination.component';
import { mostValuableKillsMockup } from '../../../mocks/mocks';

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
    imports: [MostValuableKillsComponent, KillTableComponent, PaginationComponent]
})
export class HomeComponent implements OnInit {
    rows = [1, 2, 4, 5, 6, 7, 8, 9, 10];
    mostValuableKillsMockup = mostValuableKillsMockup;
    ngOnInit(): void {
        console.log('home component')
    }
}
