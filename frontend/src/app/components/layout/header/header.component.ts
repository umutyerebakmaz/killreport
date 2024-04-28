import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusService } from '@app/service/esi/status.service';
import { DatePipe, DecimalPipe } from '@angular/common';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [MatButtonModule, MatIcon, MatMenuModule, MatDivider, MatTooltipModule, DecimalPipe, DatePipe],
    templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
    #statusService = inject(StatusService);
    players?: number;
    eveTime!: string;

    ngOnInit(): void {
        this.getStatus();
        this.eveTime = this.getUTCDateTime();
    }

    getStatus(): void {
        this.#statusService.getStatus().subscribe(data => {
            this.players = data.players;
        });
    }

    getUTCDateTime() {
        const now = new Date();
        const utcString = now.getUTCHours() + ':' + (now.getUTCMinutes() < 10 ? '0' : '') + now.getUTCMinutes();
        return utcString;
    }
}
