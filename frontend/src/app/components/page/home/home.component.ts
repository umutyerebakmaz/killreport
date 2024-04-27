import { Component, OnInit, inject } from '@angular/core';
import { AllianceService } from '@app/service/esi/alliance.service';
import { CharacterInfoCardComponent } from '@common/character-info-card/character-info-card.component';
import { RankInfoCardComponent } from '@common/rank-info-card/rank-info-card.component';

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
    imports: [CharacterInfoCardComponent, RankInfoCardComponent],
})
export class HomeComponent implements OnInit {
    #allianceService = inject(AllianceService);
    ngOnInit(): void {
        this.#allianceService.getAllianceIcon(99003581).subscribe(data => {
            console.log(data);
        });
    }
}
