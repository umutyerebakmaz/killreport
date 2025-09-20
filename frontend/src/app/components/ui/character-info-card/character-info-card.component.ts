import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Character } from '@page/character/character.component';

@Component({
    standalone: true,
    selector: 'character-info-card',
    templateUrl: './character-info-card.component.html',
    imports: [RouterLink]
})
export class CharacterInfoCardComponent {
    @Input() character!: Character;
}
