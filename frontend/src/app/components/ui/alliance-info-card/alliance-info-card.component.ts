import { Component, Input } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { Alliance } from '@page/alliance/alliance.component';

@Component({
    standalone: true,
    selector: 'alliance-info-card',
    templateUrl: './alliance-info-card.component.html',
    imports: [MatTooltip],
})
export class AllianceInfoCardComponent {
    @Input() alliance!: Alliance;
}
