import { Component, OnInit, inject } from '@angular/core';
import { AllianceService } from '@service/esi/alliance.service';
import { CharacterInfoCardComponent } from '@app/components/ui/character-info-card/character-info-card.component';

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
    imports: [CharacterInfoCardComponent],
})
export class HomeComponent implements OnInit {
    #allianceService = inject(AllianceService);
    ngOnInit(): void {
        this.#allianceService.getAllianceIcon(99003581).subscribe(data => {
            console.log(data);
        });
    }
}
