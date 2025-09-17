import { Component, Input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { Corporation } from '@app/components/page/corporation/corporation.component';

@Component({
    standalone: true,
    selector: 'corporation-info-card',
    templateUrl: './corporation-info-card.component.html',
    imports: [MatTooltip],
})
export class CorporationInfoCardComponent {
    @Input() corporation!: Corporation;
}
