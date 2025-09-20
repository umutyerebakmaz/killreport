import { NgIf } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

export type Item = {
    image: string;
    type: string;
    character: string;
    amount: string;
    index: number;
};

@Component({
    selector: 'valuable-kill-item',
    standalone: true,
    imports: [NgIf, RouterLink],
    templateUrl: './valuable-kill-item.component.html',
})
export class ValuableKillItemComponent {
    @Input() item!: Item;
    @Input() rank!: number;
}
