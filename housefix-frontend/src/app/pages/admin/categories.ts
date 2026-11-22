import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Categorie, TauxTva } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils';
import { translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';

interface TauxForm {
  id?: number;
  libelle: string;
  taux: number | null;
  par_defaut: boolean;
}

@Component({
  standalone: true,
  selector: 'app-categories',
  imports: [FormsModule, ...I18N],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2>{{ 'admin.categories.title' | t }}</h2>
          <p>{{ 'admin.categories.subtitle' | t }}</p>
        </div>
        <button type="button" class="btn btn-primary" (click)="openCreate()"><i class="bi bi-plus-lg"></i> {{ 'admin.categories.new' | t }}</button>
      </div>

      @if (loading()) {
        <div class="spinner"></div>
      } @else {
        <div class="grid-cards">
          @for (c of items(); track c.id) {
            <div class="card cat-card">
              <div class="row-between">
                <span class="cat-icon"><i class="bi {{ c.icone || 'bi-tools' }}"></i></span>
                <div class="row actions">
                  <button type="button" class="btn btn-ghost btn-icon" (click)="openEdit(c)" [title]="'common.actions.edit' | t" [attr.aria-label]="'common.actions.edit' | t"><i class="bi bi-pencil"></i></button>
                  <button type="button" class="btn btn-ghost btn-icon del" [disabled]="deleting() === c.id" (click)="remove(c)" [title]="'common.actions.delete' | t" [attr.aria-label]="'common.actions.delete' | t"><i class="bi bi-trash"></i></button>
                </div>
              </div>
              <h3 class="mt">{{ c.nom }}</h3>
              <p class="muted small desc">{{ c.description || ('admin.categories.noDescription' | t) }}</p>
              <span class="badge badge-violet"><i class="bi bi-percent"></i> {{ 'admin.tva.badge' | t: { taux: ((c.taux_tva ?? 0) | appNumber: '1.0-2') } }}</span>
              <span class="badge badge-primary"><i class="bi bi-people"></i> {{ (c.prestataires_count === 1 ? 'admin.categories.prestataires.one' : 'admin.categories.prestataires.other') | t: { count: c.prestataires_count } }}</span>
            </div>
          } @empty {
            <div class="card empty-state full">
              <i class="bi bi-grid"></i>
              {{ 'admin.categories.empty' | t }}
            </div>
          }
        </div>

        <div class="card tva-card">
          <div class="card-header">
            <div>
              <h3>{{ 'admin.tva.title' | t }}</h3>
              <p class="muted small">{{ 'admin.tva.subtitle' | t }}</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" (click)="openTaux()"><i class="bi bi-plus-lg"></i> {{ 'admin.tva.new' | t }}</button>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'admin.tva.label' | t }}</th>
                  <th class="text-right">{{ 'admin.tva.rate' | t }}</th>
                  <th>{{ 'admin.tva.services' | t }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of taux(); track t.id) {
                  <tr>
                    <td>
                      {{ t.libelle }}
                      @if (t.par_defaut) { <span class="badge badge-success">{{ 'admin.tva.default' | t }}</span> }
                    </td>
                    <td class="text-right nowrap"><strong>{{ t.taux | appNumber: '1.0-2' }} %</strong></td>
                    <td>{{ t.categories_count }}</td>
                    <td class="text-right nowrap">
                      <button type="button" class="btn btn-ghost btn-icon" (click)="openTaux(t)" [title]="'common.actions.edit' | t" [attr.aria-label]="'common.actions.edit' | t"><i class="bi bi-pencil"></i></button>
                      @if (!t.par_defaut) {
                        <button type="button" class="btn btn-ghost btn-icon del" (click)="removeTaux(t)" [title]="'common.actions.delete' | t" [attr.aria-label]="'common.actions.delete' | t"><i class="bi bi-trash"></i></button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <span class="form-hint"><i class="bi bi-info-circle"></i> {{ 'admin.tva.legalHint' | t }}</span>
        </div>
      }
    </div>

    @if (tauxEdit(); as te) {
      <div class="modal-backdrop" (click)="tauxEdit.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ (te.id ? 'admin.tva.edit' : 'admin.tva.new') | t }}</h3>
          <div class="form-group">
            <label class="form-label" for="tva-libelle">{{ 'admin.tva.label' | t }}</label>
            <input id="tva-libelle" class="form-control" [(ngModel)]="te.libelle" [placeholder]="'admin.tva.labelPlaceholder' | t" />
          </div>
          <div class="form-group">
            <label class="form-label" for="tva-taux">{{ 'admin.tva.rate' | t }} (%)</label>
            <input id="tva-taux" type="number" min="0" max="100" step="0.01" class="form-control" [(ngModel)]="te.taux" dir="ltr" />
          </div>
          <label class="row check">
            <input type="checkbox" [(ngModel)]="te.par_defaut" />
            <span>{{ 'admin.tva.setDefault' | t }}</span>
          </label>
          <span class="form-hint">{{ 'admin.tva.futureOnly' | t }}</span>
          @if (tauxError()) {
            <div class="alert alert-danger">{{ tauxError() }}</div>
          }
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="tauxEdit.set(null)">{{ 'common.actions.cancel' | t }}</button>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="saveTaux(te)">
              <i class="bi bi-check-lg"></i> {{ 'common.actions.save' | t }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="close()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>{{ (editing() ? 'admin.categories.edit' : 'admin.categories.new') | t }}</h3>
          <div class="form-group">
            <label class="form-label" for="cat-nom">{{ 'admin.categories.name' | t }}</label>
            <input id="cat-nom" class="form-control" [class.invalid]="!!errors()['nom']" [(ngModel)]="nom" [placeholder]="'admin.categories.namePlaceholder' | t" dir="ltr" lang="fr" />
            @if (errors()['nom']) {
              <span class="form-error">{{ errors()['nom'] }}</span>
            }
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-nom-ar">{{ 'admin.categories.nameAr' | t }}</label>
            <input id="cat-nom-ar" class="form-control" dir="rtl" lang="ar" [class.invalid]="!!errors()['nom_ar']" [(ngModel)]="nomAr" [placeholder]="'admin.categories.nameArPlaceholder' | t" />
            @if (errors()['nom_ar']) {
              <span class="form-error">{{ errors()['nom_ar'] }}</span>
            }
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-nom-en">{{ 'admin.categories.nameEn' | t }}</label>
            <input id="cat-nom-en" class="form-control" dir="ltr" lang="en" [class.invalid]="!!errors()['nom_en']" [(ngModel)]="nomEn" [placeholder]="'admin.categories.nameEnPlaceholder' | t" />
            @if (errors()['nom_en']) {
              <span class="form-error">{{ errors()['nom_en'] }}</span>
            }
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-desc">{{ 'admin.categories.description' | t }}</label>
            <textarea id="cat-desc" class="form-control" [(ngModel)]="description" [placeholder]="'admin.categories.descriptionPlaceholder' | t" dir="ltr" lang="fr"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-desc-ar">{{ 'admin.categories.descriptionAr' | t }}</label>
            <textarea id="cat-desc-ar" class="form-control" dir="rtl" lang="ar" [(ngModel)]="descriptionAr" [placeholder]="'admin.categories.descriptionArPlaceholder' | t"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-desc-en">{{ 'admin.categories.descriptionEn' | t }}</label>
            <textarea id="cat-desc-en" class="form-control" dir="ltr" lang="en" [(ngModel)]="descriptionEn" [placeholder]="'admin.categories.descriptionEnPlaceholder' | t"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-tva">{{ 'admin.tva.categoryRate' | t }}</label>
            <select id="cat-tva" class="form-control" [(ngModel)]="tauxTvaId">
              <option [ngValue]="null">{{ 'admin.tva.useDefault' | t: { taux: (defaultTaux() | appNumber: '1.0-2') } }}</option>
              @for (t of taux(); track t.id) {
                <option [ngValue]="t.id">{{ t.libelle }} ({{ t.taux | appNumber: '1.0-2' }} %)</option>
              }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="cat-icone">{{ 'admin.categories.icon' | t }}</label>
            <div class="row icon-input">
              <span class="cat-icon"><i class="bi {{ icone || 'bi-question' }}"></i></span>
              <input id="cat-icone" class="form-control grow" [(ngModel)]="icone" placeholder="bi-tools" dir="ltr" />
            </div>
            <div class="suggestions">
              @for (s of suggestions; track s) {
                <button type="button" class="sugg" [class.active]="icone === s" (click)="icone = s" [title]="s">
                  <i class="bi {{ s }}"></i>
                </button>
              }
            </div>
            <span class="form-hint">{{ 'admin.categories.iconHint' | t }}</span>
          </div>
          @if (error()) {
            <div class="alert alert-danger">{{ error() }}</div>
          }
          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" (click)="close()">{{ 'common.actions.cancel' | t }}</button>
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">
              <i class="bi bi-check-lg"></i> {{ 'common.actions.save' | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    .cat-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .cat-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: var(--primary-soft);
      color: var(--primary);
      font-size: 1.35rem;
    }

    .actions {
      gap: 2px;
    }

    .tva-card {
      margin-top: 20px;
    }

    .check {
      gap: 8px;
      margin-bottom: 6px;
      cursor: pointer;
    }

    .del:hover {
      color: var(--danger);
    }

    .mt {
      margin-top: 8px;
    }

    .desc {
      flex: 1;
      margin-bottom: 8px;
    }

    .badge {
      align-self: flex-start;
    }

    .full {
      grid-column: 1/-1;
    }

    .icon-input {
      flex-wrap: nowrap;
    }

    .grow {
      flex: 1;
    }

    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .sugg {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
      font-size: 1rem;
    }
    .sugg.active, .sugg:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: var(--primary-soft);
    }
  `,
})
export class CategoriesPage {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);

  protected readonly suggestions = [
    'bi-droplet', 'bi-lightning-charge', 'bi-key', 'bi-snow', 'bi-hammer',
    'bi-stars', 'bi-tree', 'bi-brush', 'bi-tools', 'bi-house',
  ];

  protected readonly items = signal<Categorie[]>([]);
  protected readonly loading = signal(true);
  protected readonly deleting = signal<number | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly editing = signal<Categorie | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected nom = '';
  protected description = '';
  protected nomAr = '';
  protected descriptionAr = '';
  protected nomEn = '';
  protected descriptionEn = '';
  protected icone = '';
  protected tauxTvaId: number | null = null;

  // Taux de TVA (gérés par l'admin, jamais codés dans le frontend)
  protected readonly taux = signal<TauxTva[]>([]);
  protected readonly defaultTaux = computed(() => this.taux().find((t) => t.par_defaut)?.taux ?? 0);
  protected readonly tauxEdit = signal<TauxForm | null>(null);
  protected readonly tauxError = signal<string | null>(null);

  constructor() {
    this.loadTaux();
    this.api.categories().subscribe({
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

  protected openCreate(): void {
    this.editing.set(null);
    this.nom = '';
    this.description = '';
    this.nomAr = '';
    this.descriptionAr = '';
    this.nomEn = '';
    this.descriptionEn = '';
    this.icone = 'bi-tools';
    this.tauxTvaId = null;
    this.openModal();
  }

  protected openEdit(c: Categorie): void {
    this.editing.set(c);
    // Champs bilingues si l'API les fournit, sinon repli sur le nom/la description affichés.
    this.nom = c.nom_fr ?? c.nom;
    this.description = (c.description_fr !== undefined ? c.description_fr : c.description) ?? '';
    this.nomAr = c.nom_ar ?? '';
    this.descriptionAr = c.description_ar ?? '';
    this.nomEn = c.nom_en ?? '';
    this.descriptionEn = c.description_en ?? '';
    this.icone = c.icone ?? '';
    this.tauxTvaId = c.taux_tva_id ?? null;
    this.openModal();
  }

  protected close(): void {
    this.modalOpen.set(false);
  }

  protected save(): void {
    if (!this.nom.trim()) {
      this.errors.set({ nom: translate('admin.categories.nameRequired') });
      return;
    }
    const payload = {
      nom: this.nom.trim(),
      description: this.description.trim() || null,
      icone: this.icone.trim() || null,
      nom_ar: this.nomAr.trim() || null,
      description_ar: this.descriptionAr.trim() || null,
      nom_en: this.nomEn.trim() || null,
      description_en: this.descriptionEn.trim() || null,
      taux_tva_id: this.tauxTvaId,
    };
    const current = this.editing();
    const req = current ? this.api.updateCategorie(current.id, payload) : this.api.createCategorie(payload);
    this.saving.set(true);
    this.error.set(null);
    this.errors.set({});
    req.subscribe({
      next: (cat) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        if (current) {
          this.items.update((list) => list.map((c) => (c.id === cat.id ? { ...c, ...cat } : c)));
          this.toast.success(translate('admin.categories.updated'));
        } else {
          this.items.update((list) => [...list, { ...cat, prestataires_count: cat.prestataires_count ?? 0 }]);
          this.toast.success(translate('admin.categories.created'));
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errors.set(fieldErrors(err));
        this.error.set(errorMessage(err));
      },
    });
  }

  protected remove(c: Categorie): void {
    if (!window.confirm(translate('admin.categories.confirmDelete', { nom: c.nom }))) return;
    this.deleting.set(c.id);
    this.api.deleteCategorie(c.id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.items.update((list) => list.filter((x) => x.id !== c.id));
        this.toast.success(translate('admin.categories.deleted'));
      },
      error: (err) => {
        this.deleting.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private loadTaux(): void {
    this.api.tauxTva().subscribe({ next: (list) => this.taux.set(list), error: (err) => this.toast.error(errorMessage(err)) });
  }

  /** Les cartes affichent le taux effectif : on les recharge après un changement de taux. */
  private reloadCategories(): void {
    this.api.categories().subscribe({ next: (list) => this.items.set(list), error: () => undefined });
  }

  protected openTaux(t?: TauxTva): void {
    this.tauxError.set(null);
    this.tauxEdit.set(t ? { id: t.id, libelle: t.libelle, taux: t.taux, par_defaut: t.par_defaut } : { libelle: '', taux: null, par_defaut: false });
  }

  protected saveTaux(te: TauxForm): void {
    if (!te.libelle.trim() || te.taux === null || te.taux < 0 || te.taux > 100) {
      this.tauxError.set(translate('admin.tva.invalid'));
      return;
    }
    this.saving.set(true);
    this.api.saveTauxTva({ libelle: te.libelle.trim(), taux: te.taux, par_defaut: te.par_defaut }, te.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.tauxEdit.set(null);
        this.toast.success(translate('admin.tva.saved'));
        this.loadTaux();
        this.reloadCategories();
      },
      error: (err) => {
        this.saving.set(false);
        this.tauxError.set(errorMessage(err));
      },
    });
  }

  protected removeTaux(t: TauxTva): void {
    if (!window.confirm(translate('admin.tva.confirmDelete', { libelle: t.libelle }))) return;
    this.api.deleteTauxTva(t.id).subscribe({
      next: () => {
        this.toast.success(translate('admin.tva.deleted'));
        this.loadTaux();
        this.reloadCategories();
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }

  private openModal(): void {
    this.error.set(null);
    this.errors.set({});
    this.modalOpen.set(true);
  }
}
