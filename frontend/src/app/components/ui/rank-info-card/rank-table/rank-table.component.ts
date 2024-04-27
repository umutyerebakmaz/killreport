import { Component, Input } from '@angular/core';

@Component({
    standalone: true,
    selector: 'rank-table',
    templateUrl: './rank-table.component.html',
})
export class RankTableComponent {
    @Input() rankTable: any;
}
