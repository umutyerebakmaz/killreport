import { NgClass, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RankTableComponent } from './rank-table/rank-table.component';

type RankFilter = 'ALLTIME' | 'MONTHLY' | 'WEEKLY' | 'DAILY';

@Component({
    standalone: true,
    selector: 'rank-info-card',
    templateUrl: './rank-info-card.component.html',
    imports: [MatButton, NgIf, NgClass, RankTableComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankInfoCardComponent implements OnInit {
    get getButtonClass() {
        return {
            'transition duration-300 ease-in-out': true,
            'px-2 py-1 text-sm text-white rounded-md shadow-sm cursor-pointer bg-white/10 hover:bg-white/20': true,
            'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 focus:ring-offset-black': true,
        };
    }

    rankFilter: RankFilter = 'ALLTIME';
    rankTable: any;

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

    ngOnInit(): void {
        this.rankTable = this.allTime;
    }

    onRankFilterChange(filter: RankFilter): void {
        // will be replaced by GraphQL requests
        if (filter === 'ALLTIME') this.rankTable = this.allTime;
        if (filter === 'MONTHLY') this.rankTable = this.monthly;
        if (filter === 'WEEKLY') this.rankTable = this.weekly;
        if (filter === 'DAILY') this.rankTable = this.daily;
    }
}
