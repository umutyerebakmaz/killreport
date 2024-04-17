import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type status = {
  players?: number,
  server_version?: string,
  start_time?: string
};

@Injectable({
  providedIn: 'root'
})
export class StatusService {

  private apiUrl = 'https://esi.evetech.net/latest/status/?datasource=tranquility';

  constructor(private http: HttpClient) {}

  getStatus(): Observable<status> {
    return this.http.get<status>(this.apiUrl);
  }
}
