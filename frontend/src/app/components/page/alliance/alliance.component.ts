import { Component } from '@angular/core';
import { AllianceInfoCardComponent } from '@app/components/commons/alliance-info-card/alliance-info-card.component';
import { RankInfoCardComponent } from '@app/components/common/rank-info-card/rank-info-card.component';

@Component({
    standalone: true,
    selector: 'alliance',
    templateUrl: './alliance.component.html',
    imports: [AllianceInfoCardComponent, RankInfoCardComponent]
})
export class AllianceComponent {}
