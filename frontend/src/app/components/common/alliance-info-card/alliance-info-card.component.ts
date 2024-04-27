import { Component } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

type Alliance = {
  name: string;
  ticked: string;
  executor: string;
  members: string;
};
@Component({
  standalone: true,
  selector: 'alliance-info-card',
  templateUrl: './alliance-info-card.component.html',
  imports: [MatTooltip]
})
export class AllianceInfoCardComponent {

  alliance: Alliance = {
    name: 'Fraternity.',
    ticked: 'FRT',
    executor: 'FRT Holding',
    members: '36,213',
  };
}
