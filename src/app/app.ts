import { Component } from '@angular/core';
import { Header } from './Feature/header/header';

@Component({
  selector: 'app-root',
  imports: [Header],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  title = 'modernTrafficLight';
}
