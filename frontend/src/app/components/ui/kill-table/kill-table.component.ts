import { NgClass, NgFor } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'kill-table',
    standalone: true,
    imports: [NgClass, RouterLink],
    templateUrl: './kill-table.component.html',
})
export class KillTableComponent {
    @Input() rows!: number[];

    trackByFn(index: number, name: any): number {
        return name.id;
    }
}
