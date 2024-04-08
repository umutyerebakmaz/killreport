import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDivider } from '@angular/material/divider';

@Component({
    selector: 'app-header',
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatMenuModule, MatDivider],
    templateUrl: './header.component.html',
})
export class HeaderComponent {

}
