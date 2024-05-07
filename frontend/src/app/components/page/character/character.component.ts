import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CharacterInfoCardComponent } from '@app/components/common/character-info-card/character-info-card.component';
import { RankInfoCardComponent } from '@common/rank-info-card/rank-info-card.component';
import { RankFilterService } from '@service/rank-filter.service';
import { Subscription } from 'rxjs';
import { MostValuableKillsComponent } from '@common/most-valuable-kills/most-valuable-kills.component';
import { KillTableComponent } from '@app/components/common/kill-table/kill-table.component';

export type Character = {
    name: string;
    alliance: string;
    allianceTicked: string;
    corporation: string;
    corporationTicked: string;
    security: string;
};
@Component({
    standalone: true,
    selector: 'character',
    templateUrl: './character.component.html',
    imports: [CharacterInfoCardComponent, RankInfoCardComponent, MostValuableKillsComponent, KillTableComponent]
})
export class CharacterComponent implements OnInit, OnDestroy {

    #rankFilterService = inject(RankFilterService);

    rankFilterSub!: Subscription;

    character: Character = {
        name: 'General XAN',
        alliance: 'Fraternity.',
        allianceTicked: 'FRT',
        corporation: 'Kenshin.',
        corporationTicked: '[300M]',
        security: '5.0',
    };

    allTime: any = {
        rankTitle: 'Alltime Rank',
        ships: {
            destroyed: '2,970',
            destroyedRank: '26,965',
            lost: '349',
            lostRank: '26,026',
            efficiency: '89.5',
            allTimeRank: '38,579',
        },
        points: {
            destroyed: '3,482',
            destroyedRank: '47,530',
            lost: '1,232',
            lostRank: '41,927',
            efficiency: '73.9',
        },
        isk: {
            destroyed: '724.74b',
            destroyedRank: '64,359',
            lost: '29.25b',
            lostRank: '39,445',
            efficiency: '96.1',
        },
    };

    monthly: any = {
        rankTitle: 'Monthly Rank',
        ships: {
            destroyed: '485',
            destroyedRank: '2,140',
            lost: '37',
            lostRank: '5,059',
            efficiency: '92.9',
            allTimeRank: '3,103',
        },
        points: {
            destroyed: '554',
            destroyedRank: '4,695',
            lost: '121',
            lostRank: '	8,961',
            efficiency: '82.1',
        },
        isk: {
            destroyed: '145.28b',
            destroyedRank: '7,045',
            lost: '2.21b',
            lostRank: '18,948',
            efficiency: '98.5',
        },
    };

    weekly: any = {
        rankTitle: 'Weekly Rank',
        ships: {
            destroyed: '26',
            destroyedRank: '5,952',
            lost: '3',
            lostRank: '7,983',
            efficiency: '89.7',
            allTimeRank: '9,251',
        },
        points: {
            destroyed: '36',
            destroyedRank: '7,511',
            lost: '23',
            lostRank: '4,953',
            efficiency: '61.0',
        },
        isk: {
            destroyed: '724.74b',
            destroyedRank: '64,359',
            lost: '29.25b',
            lostRank: '39,445',
            efficiency: '96.1',
        },
    };

    daily: any = {
        rankTitle: 'Daily Rank',
        ships: {
            destroyed: '-',
            destroyedRank: '-',
            lost: '-',
            lostRank: '-',
            efficiency: '-',
            allTimeRank: '-',
        },
        points: {
            destroyed: '-',
            destroyedRank: '-',
            lost: '-',
            lostRank: '-',
            efficiency: '-',
        },
        isk: {
            destroyed: '-',
            destroyedRank: '-',
            lost: '-',
            lostRank: '-',
            efficiency: '-',
        },
    };

    rank!: any;

    rows = [1, 2, 4, 5, 6, 7, 8, 9, 10];

    ngOnInit(): void {
        this.rankFilterSub = this.#rankFilterService.filter$.subscribe(filter => {
            if (filter === 'ALLTIME') this.rank = this.allTime;
            if (filter === 'MONTHLY') this.rank = this.monthly;
            if (filter === 'WEEKLY') this.rank = this.weekly;
            if (filter === 'DAILY') this.rank = this.daily;
        });
    }

    ngOnDestroy(): void {
        if (this.rankFilterSub) this.rankFilterSub.unsubscribe();
    }

}
