import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { RdvStatus, RendezVous, rdvStatusLabel } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, mapsUrl } from '../../core/utils';
import { I18N } from '../../i18n/pipes';
import { StatusBadge } from '../../shared/status-badge';

type Tab = 'tous' | RdvStatus;

@Component({
  standalone: true,
  selector: 'app-admin-rendez-vous',
  imports: [...I18N, FormsModule, StatusBadge],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'admin.rendezVous.title' | t }}</h2>
          <p>{{ (items().length === 1 ? 'admin.rendezVous.subtitle.one' : 'admin.rendezVous.subtitle.other') | t: { count: items().length } }}</p>
        </div>
        <div class="search">
          <i class="bi bi-search"></i>
          <input
            type="search"
            class="form-control"
            [placeholder]="'admin.rendezVous.searchPlaceholder' | t"
            [ngModel]="search()"
            (ngModelChange)="search.set($event)"
            [attr.aria-label]="'admin.rendezVous.searchAria' | t"
          />
        </div>
      </div>

      <div class="tabs">
        @for (t of tabs; track t) {
          <button type="button" [class.active]="tab() === t" (click)="tab.set(t)">
            {{ t === 'tous' ? ('admin.shared.all' | t) : statusLabel(t) }} ({{ counts()[t] ?? 0 }})
          </button>
        }
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="grid-cards">
          @for (r of filtered(); track r.id) {
            <div class="card rdv">
              <div class="row-between">
                <app-status-badge [status]="r.status" />
                <span class="small muted">#{{ r.id }}</span>
              </div>
              <h3 class="cat">{{ r.categorie.nom }}</h3>
              <div class="stack lines">
                <div class="info-line">
                  <i class="bi bi-calendar-event"></i>
                  <span>{{ r.date | appDate: 'full' }} · {{ r.heure ?? ('admin.rendezVous.timeUnspecified' | t) }}</span>
                </div>
                <div class="info-line"><i class="bi bi-geo-alt"></i><span>{{ r.address ?? ('admin.rendezVous.noAddress' | t) }}</span></div>
                <div class="info-line"><i class="bi bi-person"></i><span>{{ r.client.nom }}</span></div>
                <div class="info-line"><i class="bi bi-person-badge"></i><span>{{ 'admin.rendezVous.prestataire' | t: { nom: r.prestataire.nom } }}</span></div>
                @if (r.facture) {
                  <div class="info-line"><i class="bi bi-receipt"></i><span>{{ 'admin.rendezVous.invoice' | t: { numero: r.facture.numero } }} · <strong>{{ 'admin.shared.amount' | t: { amount: (r.facture.montant | appNumber: '1.2-2') } }}</strong></span></div>
                }
              </div>
              <div class="card-footer">
                <a class="btn btn-outline btn-sm" [href]="maps(r)" target="_blank" rel="noopener"><i class="bi bi-map"></i> {{ 'admin.rendezVous.openMaps' | t }}</a>
              </div>
            </div>
          } @empty {
            <div class="card empty-state full">
              <i class="bi bi-calendar-x"></i>
              {{ 'admin.rendezVous.empty' | t }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .search {
      position: relative;
      width: min(340px, 100%);
    }
    .search i {
      position: absolute;
      inset-inline-start: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
    }
    .search .form-control {
      padding-inline-start: 36px;
    }

    .rdv {
      display: flex;
      flex-direction: column;
    }

    .cat {
      margin: 12px 0 10px;
    }

    .lines {
      flex: 1;
      gap: 8px;
    }

    .full {
      grid-column: 1/-1;
    }
  `,
})
export class AdminRendezVous {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly statusLabel = rdvStatusLabel;
  protected readonly tabs: Tab[] = ['tous', 'en_attente', 'accepte', 'termine', 'facture', 'refuse', 'annule_par_client'];

  protected readonly items = signal<RendezVous[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<Tab>('tous');
  protected readonly search = signal('');

  protected readonly counts = computed(() => {
    const c: Partial<Record<Tab, number>> = { tous: this.items().length };
    for (const r of this.items()) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  });

  protected readonly filtered = computed(() => {
    const t = this.tab();
    const q = this.search().trim().toLowerCase();
    return this.items().filter((r) => {
      if (t !== 'tous' && r.status !== t) return false;
      if (!q) return true;
      return [r.client.nom, r.prestataire.nom, r.categorie.nom].some((v) => v?.toLowerCase().includes(q));
    });
  });

  constructor() {
    this.api.rendezVous().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected maps(r: RendezVous): string {
    return mapsUrl(r.latitude, r.longitude, r.address);
  }
}
