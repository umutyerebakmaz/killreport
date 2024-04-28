import { Component } from '@angular/core';
import { AllianceInfoCardComponent } from '@app/components/common/alliance-info-card/alliance-info-card.component';
import { RankInfoCardComponent } from '@app/components/common/rank-info-card/rank-info-card.component';

export type Alliance = {
  name: string;
  ticked: string;
  executor: string;
  members: string;
};
@Component({
  standalone: true,
  selector: 'alliance',
  templateUrl: './alliance.component.html',
  imports: [AllianceInfoCardComponent, RankInfoCardComponent]
})
export class AllianceComponent {

  alliance: Alliance = {
    name: 'Fraternity.',
    ticked: 'FRT',
    executor: 'FRT Holding',
    members: '36,213',
  };


}
