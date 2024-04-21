import { Component, OnInit, inject } from '@angular/core';
import { AllianceService } from '../../../services/esi/alliance.service';

@Component({
    standalone: true,
    selector: 'home',
    templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
    #allianceService = inject(AllianceService);
    ngOnInit(): void {
        this.#allianceService.getAllianceIcon(99003581).subscribe(data => {
            console.log(data);
        });
    }
}
