import { Component, OnInit } from '@angular/core';
import { MatPaginatorModule } from '@angular/material/paginator';

@Component({
    standalone: true,
    selector: 'pagination',
    templateUrl: './pagination.component.html',
    imports: [MatPaginatorModule],
})
export class PaginationComponent implements OnInit {
    constructor() {}

    ngOnInit() {}
}
