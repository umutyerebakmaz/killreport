import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RankFilter, RankFilterService } from '../../../service/rank-filter.service';

@Component({
    standalone: true,
    selector: 'rank-info-card',
    templateUrl: './rank-info-card.component.html',
    imports: [MatButton, NgIf, NgClass],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankInfoCardComponent {
    @Input() rank: any;

    #rankFilterService = inject(RankFilterService);

    get getButtonClass() {
        return {
            'transition duration-300 ease-in-out': true,
            'px-2 py-1 text-sm text-white rounded-md shadow-sm cursor-pointer bg-white/10 hover:bg-white/20': true,
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-black': true,
        };
    }

    onRankFilterChange(filter: RankFilter): void {
        this.#rankFilterService.set(filter);
    }
}
