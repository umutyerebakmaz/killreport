import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type RankFilter = 'ALLTIME' | 'MONTHLY' | 'WEEKLY' | 'DAILY';

@Injectable({
    providedIn: 'root',
})
export class RankFilterService {

    #subject = new BehaviorSubject<RankFilter>('ALLTIME');

    filter$: Observable<RankFilter> = this.#subject.asObservable();

    set(filter: RankFilter) {
        this.#subject.next(filter);
    }

}
