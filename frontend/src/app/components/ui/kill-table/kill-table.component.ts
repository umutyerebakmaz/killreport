import { NgClass, NgFor } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
    selector: 'kill-table',
    standalone: true,
    imports: [NgFor, NgClass],
    templateUrl: './kill-table.component.html',
})
export class KillTableComponent {
    @Input() rows!: number[];

    trackByFn(index: number, name: any): number {
        return name.id;
    }

}
