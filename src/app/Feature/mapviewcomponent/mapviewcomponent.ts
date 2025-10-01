import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as L from 'leaflet';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { IAreaService } from '../../Services/Area/iarea-service';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { GetLightPattern } from '../../Domain/Entity/LightPattern/GetLightPattern';
import { AddSignBoxWithUpdateLightPattern } from '../../Domain/Entity/SignControlBox/AddSignBoxWithUpdateLightPattern';

@Component({
  selector: 'app-mapviewcomponent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mapviewcomponent.html',
  styleUrl: './mapviewcomponent.css',
})
export class Mapviewcomponent implements OnInit, OnDestroy {
  ngOnDestroy(): void {
    if (this.map) {
      this.map.off();
      this.map.remove();
    }
  }
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;
  private map!: L.Map;
  private marker!: L.Marker;

  private fb = inject(FormBuilder);
  private readonly governateService = inject(IGovernateService);
  private readonly areaService = inject(IAreaService);
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly templateService = inject(ITemplateService);
  private readonly lightPatternService = inject(LightPatternService);

  trafficForm!: FormGroup;
  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  templates: GetAllTemplate[] = [];
  templatePatterns: LightPatternForTemplatePattern[] = [];
  selectedLightPatternId: number | null = null;
  lightPattern: GetLightPattern | null = null;

  ngOnInit(): void {
    this.trafficForm = this.fb.group({
      governorate: ['', Validators.required],
      area: [null, Validators.required],
      name: ['', Validators.required],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      ipAddress: ['', Validators.required],
      template: ['0'],
      greenTime: [0],
      amberTime: [0],
      redTime: [{ value: 0, disabled: true }],
    });

    this.loadGovernate();
    this.loadAllTemplates();
  }
  private initMap(): void {
    if (this.map) return; // prevent re-initialization
    this.map = L.map(this.mapContainer.nativeElement).setView([30.0444, 31.2357], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      if (this.marker) {
        this.map.removeLayer(this.marker);
      }

      this.marker = L.marker([lat, lng]).addTo(this.map);

      this.trafficForm.patchValue({
        latitude: lat,
        longitude: lng,
      });
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }
  get f() {
    return this.trafficForm.controls;
  }

  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => (this.governates = data.value));
  }

  getAreas(id: number) {
    this.areaService.getAll(id).subscribe((data) => (this.areas = data.value));
  }

  loadAllTemplates() {
    this.templateService.GetAll().subscribe((result) => (this.templates = result.value));
  }

  onGovernorateChange(e: Event) {
    const id = Number((e.target as HTMLSelectElement).value);
    this.getAreas(id);
  }

  onTemplateChange(e: Event) {
    const templateId = Number((e.target as HTMLSelectElement).value);
    if (!templateId) {
      this.templatePatterns = [];
      return;
    }
    this.templatePatternService
      .GetAllTemplatePatternByTemplateId(templateId)
      .subscribe((result) => (this.templatePatterns = result.value));
  }

  onTemplatePatternChange(lightPatternId: number) {
    this.selectedLightPatternId = lightPatternId;
    this.lightPatternService.getById(lightPatternId).subscribe((result) => {
      const lp = Array.isArray(result.value) ? result.value[0] : result.value;
      if (!lp) return;
      this.lightPattern = lp;
      const redCtrl = this.trafficForm.get('redTime');
      redCtrl?.enable();
      this.trafficForm.patchValue({ greenTime: lp.green, amberTime: lp.yellow, redTime: lp.red });
      redCtrl?.disable();
    });
  }

  onApply() {
    if (this.trafficForm.invalid || !this.selectedLightPatternId) {
      this.trafficForm.markAllAsTouched();
      alert('Fill form and select Pattern');
      return;
    }

    const raw = this.trafficForm.getRawValue();
    const payload: AddSignBoxWithUpdateLightPattern = {
      name: raw.name,
      latitude: raw.latitude,
      longitude: raw.longitude,
      lightPatternId: this.selectedLightPatternId,
      areaId: raw.area,
      redTime: raw.redTime,
      yellowTime: raw.amberTime,
      greenTime: raw.greenTime,
      ipAddress: raw.ipAddress,
      directions: [],
    };

    console.log('Submitting:', payload);
    this.signBoxService.AddWithUpdateLightPattern(payload).subscribe();
  }
}
