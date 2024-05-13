import { Component, Input } from '@angular/core';
import { Character } from '@page/character/character.component';

@Component({
  standalone: true,
  selector: 'character-info-card',
  templateUrl: './character-info-card.component.html',
})
export class CharacterInfoCardComponent {
  @Input() character!: Character;
}
