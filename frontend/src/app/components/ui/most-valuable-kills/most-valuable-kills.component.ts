import { Component, Input } from '@angular/core';
import { ValuableKillItemComponent } from './valuable-kill-item/valuable-kill-item.component';
import { NgFor } from '@angular/common';
import { ChevronLeftComponent } from './chevron-left/chevron-left.component';
import { ChevronRightComponent } from './chevron-right/chevron-right.component';

@Component({
    selector: 'most-valuable-kills',
    standalone: true,
    imports: [ValuableKillItemComponent, NgFor, ChevronLeftComponent, ChevronRightComponent],
    templateUrl: './most-valuable-kills.component.html',
})
export class MostValuableKillsComponent {
    @Input() data: any;
}
