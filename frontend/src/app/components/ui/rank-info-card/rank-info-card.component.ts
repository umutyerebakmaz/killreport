import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RankTableComponent } from './rank-table/rank-table.component';
@Component({
    standalone: true,
    selector: 'rank-info-card',
    templateUrl: './rank-info-card.component.html',
    imports: [MatButton, NgIf, NgClass, RankTableComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankInfoCardComponent {
    tab: number = 1;

    get getButtonClass() {
        return {
            'transition duration-300 ease-in-out': true,
            'px-2 py-1 text-sm text-white rounded-md shadow-sm cursor-pointer bg-white/10 hover:bg-white/20': true,
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-black': true,
        };
    }
}
