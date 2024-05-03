import { Component } from '@angular/core';
import { ValuableKillItemComponent } from './valuable-kill-item/valuable-kill-item.component';
import { NgIf } from '@angular/common';

@Component({
    selector: 'most-valuable-kills',
    standalone: true,
    imports: [ValuableKillItemComponent],
    templateUrl: './most-valuable-kills.component.html',
})
export class MostValuableKillsComponent {

}
