import { NgClass, NgFor } from '@angular/common';
import { Component } from '@angular/core';

@Component({
    selector: 'top-characters-card',
    standalone: true,
    imports: [NgClass, NgFor],
    templateUrl: './top-characters-card.component.html',
})
export class TopCharactersCardComponent {

    characters = [
        {
            character: 'YuunaBlack',
            point: 403,
        },
        {
            character: 'Northern Skyfall',
            point: 312
        },
        {
            character: 'Arthur Hemanseh',
            point: 300
        },
        {
            character: 'daoyan yin',
            point: 272
        },
        {
            character: 'fenix fs',
            point: 259
        },
        {
            character: 'Make nightmare',
            point: 229
        },
        {
            character: 'Zamira Mtskhetashi',
            point: 201
        },
        {
            character: 'Horvick',
            point: 199
        },
        {
            character: 'Onlystone',
            point: 185
        },
        {
            character: 'Snow Chaser',
            point: 179
        }
    ];
}
