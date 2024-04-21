import { Component } from '@angular/core';

type Character = {
    name: string;
    alliance: string;
    allianceTicked: string;
    corporation: string;
    corporationTicked: string;
    security: string;
};
@Component({
    standalone: true,
    selector: 'character-info-card',
    templateUrl: './character-info-card.component.html',
})
export class CharacterInfoCardComponent {
    character: Character = {
        name: 'General XAN',
        alliance: 'Fraternity.',
        allianceTicked: 'FRT',
        corporation: 'Kenshin.',
        corporationTicked: '[300M]',
        security: '5.0',
    };
}
