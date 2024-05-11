import { NgIf } from '@angular/common';
import { Component, Input } from '@angular/core';

export type Item = {
    image: string;
    type: string;
    character: string;
    amount: string;
    index: number;
}

@Component({
    selector: 'valuable-kill-item',
    standalone: true,
    imports: [NgIf],
    templateUrl: './valuable-kill-item.component.html',
})
export class ValuableKillItemComponent {
    @Input() item!: Item;
    @Input() rank!: number;

}
