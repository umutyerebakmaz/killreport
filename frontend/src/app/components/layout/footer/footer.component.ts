import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common'

@Component({
  standalone: true,
  selector: 'app-footer',
  imports: [NgOptimizedImage],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {

}
