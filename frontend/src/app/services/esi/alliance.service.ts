import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

type AllianceInformation = {
    creator_corporation_id: number;
    creator_id: number;
    date_founded: string;
    executor_corporation_id: number;
    name: string;
    ticker: string;
};

type AllianceIcon = {
    px128x128: string;
    px64x64: string;
};

@Injectable({
    providedIn: 'root',
})
export class AllianceService {
    #http = inject(HttpClient);

    /**
     * List all alliances
     * @returns {Alliances}
     */
    getListAlliances(): Observable<number[]> {
        return this.#http.get<number[]>('https://esi.evetech.net/latest/alliances/?datasource=tranquility');
    }

    /**
     * Get alliance information
     * @returns {AllianceInformation}
     */
    getAllianceInformation(allianceId: number): Observable<AllianceInformation> {
        return this.#http.get<AllianceInformation>(
            `https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`
        );
    }

    /**
     * List alliance's corporations
     * @returns {Corporations}
     */
    getAllianceCorporations(allianceId: number): Observable<number[]> {
        return this.#http.get<number[]>(
            `https://esi.evetech.net/latest/alliances/${allianceId}/?datasource=tranquility`
        );
    }

    /**
     * Get alliance icon
     * @returns {AllianceIcon}
     */
    getAllianceIcon(allianceId: number): Observable<AllianceIcon> {
        return this.#http.get<AllianceIcon>(
            `https://esi.evetech.net/latest/alliances/${allianceId}/icons/?datasource=tranquility`
        );
    }
}
