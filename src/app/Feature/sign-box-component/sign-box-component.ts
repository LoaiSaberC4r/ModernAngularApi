import { Component, OnDestroy, OnInit } from '@angular/core';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { CommonModule } from '@angular/common';
import { FormsModule, NgModel } from '@angular/forms';

@Component({
  selector: 'app-sign-box-component',
  imports: [CommonModule  , FormsModule],
  templateUrl: './sign-box-component.html',
  styleUrl: './sign-box-component.css'
})
export class SignBoxComponent implements OnInit, OnDestroy { 
searchParameter  :SearchParameters = {}  
signBoxEntity  :Pagination<GetAllSignControlBox> = {} as Pagination<GetAllSignControlBox>
  constructor(private signBoxControlService: ISignBoxControlService) {
    
    
  }
  ngOnDestroy(): void {
    throw new Error('Method not implemented.');
  }
  ngOnInit(): void {
    this.signBoxControlService.getAll(this.searchParameter)
    .subscribe(data => {
this.signBoxEntity = data ; 

    });
  }

}
