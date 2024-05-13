import { Component, Input } from '@angular/core';
import { ValuableKillItemComponent } from './valuable-kill-item/valuable-kill-item.component';
import { NgFor } from '@angular/common';

@Component({
    selector: 'most-valuable-kills',
    standalone: true,
    imports: [ValuableKillItemComponent, NgFor],
    templateUrl: './most-valuable-kills.component.html',
})
export class MostValuableKillsComponent {
    @Input() data: any;
}
