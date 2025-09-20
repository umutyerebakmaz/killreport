import { NgClass } from '@angular/common';
import { Component } from '@angular/core';

@Component({
    selector: 'top-corporations-card',
    standalone: true,
    imports: [NgClass],
    templateUrl: './top-corporations-card.component.html',
})
export class TopCorporationsCardComponent {

    corporations = [
        {
            corporation: 'ChuangShi',
            point: 1142,
        },
        {
            corporation: 'Chaos Arbiter',
            point: 1089
        },
        {
            corporation: 'Special Law Enforcer Department',
            point: 913
        },
        {
            corporation: 'Arknights.',
            point: 629
        },
        {
            corporation: 'STARCHASE INC.',
            point: 442
        },
        {
            corporation: 'Gladiator of Rage',
            point: 428
        },
        {
            corporation: 'Descendants of Dhen Nong',
            point: 423
        },
        {
            corporation: 'RomFleet',
            point: 349
        },
        {
            corporation: 'Stardust Guardian',
            point: 319
        },
    ];
}
