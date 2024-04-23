import { Component, OnInit } from '@angular/core';
import { MatButton } from '@angular/material/button';

@Component({
    standalone: true,
    selector: 'rank-info-card',
    templateUrl: './rank-info-card.component.html',
    imports: [MatButton],
})
export class RankInfoCardComponent implements OnInit {
    constructor() {}

    ngOnInit() {}
}
