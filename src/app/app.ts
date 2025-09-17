import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SignBoxComponent } from "./Feature/sign-box-component/sign-box-component";
import { Header } from "./Feature/header/header";

@Component({
  selector: 'app-root',
  imports: [SignBoxComponent, Header],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('modernTrafficLight');
}
