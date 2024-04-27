import { Component } from '@angular/core';
import { CharacterInfoCardComponent } from '@app/components/ui/character-info-card/character-info-card.component';
import { RankInfoCardComponent } from '@app/components/ui/rank-info-card/rank-info-card.component';
@Component({
    standalone: true,
    selector: 'character',
    templateUrl: './character.component.html',
    imports: [CharacterInfoCardComponent, RankInfoCardComponent]
})
export class CharacterComponent {}
