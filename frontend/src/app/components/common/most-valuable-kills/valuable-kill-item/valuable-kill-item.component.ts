import { Component, Input } from '@angular/core';

export type Item = {
    image: string;
    type: string;
    character: string;
    amount: string;
}

@Component({
    selector: 'valuable-kill-item',
    standalone: true,
    imports: [],
    templateUrl: './valuable-kill-item.component.html',
})
export class ValuableKillItemComponent {
    @Input() item!: Item;

}
