import { Component, OnInit } from '@angular/core';

@Component({
  standalone: true,
  selector: 'home',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {

  ngOnInit(): void {
    console.log('home component')
  }
}
