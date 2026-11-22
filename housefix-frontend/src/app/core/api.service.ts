import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Accueil, AdminDashboard, AppNotification, AuthResponse, Categorie, ClientDashboard, Conversation, ConversationUpdates,
  Evaluation, Facture, Litige, LitigeStatut, Message, PrestataireCard, PrestataireDashboard,
  PrestataireDetail, PrestataireSearch, RdvStatus, RegisterResponse, RendezVous, Revenus, ServicePageData, ServiceSummary, TauxTva, User,
} from './models';

/** Accès typé à toutes les routes de l'API Laravel (voir docs/API.md). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private params(filters: object = {}): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') continue;
      params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
    return params;
  }

  services(): Observable<ServiceSummary[]> {
    return this.http.get<ServiceSummary[]>(`${this.base}/services`);
  }
  servicePage(slug: string, gouvernorat?: string | null): Observable<ServicePageData> {
    return this.http.get<ServicePageData>(`${this.base}/services/${encodeURIComponent(slug)}`, { params: this.params({ gouvernorat }) });
  }
  accueil(): Observable<Accueil> {
    return this.http.get<Accueil>(`${this.base}/accueil`);
  }

  // --- Authentification & profil ---
  register(data: object): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.base}/auth/register`, data);
  }
  verifyEmail(email: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/verify-email`, { email, code });
  }
  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/resend-verification`, { email });
  }
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.base}/auth/login`, { email, password });
  }
  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/forgot-password`, { email });
  }
  verifyResetCode(email: string, code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/verify-reset-code`, { email, code });
  }
  resetPassword(data: { email: string; code: string; password: string; password_confirmation: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/auth/reset-password`, data);
  }
  logout(): Observable<unknown> {
    return this.http.post(`${this.base}/auth/logout`, {});
  }
  me(): Observable<User> {
    return this.http.get<User>(`${this.base}/auth/me`);
  }
  updateProfile(data: object): Observable<User> {
    return this.http.put<User>(`${this.base}/profile`, data);
  }
  uploadPhoto(file: File): Observable<User> {
    const form = new FormData();
    form.append('photo', file);
    return this.http.post<User>(`${this.base}/profile/photo`, form);
  }
  /** Même envoi, avec les événements de progression (barre d'avancement). */
  uploadPhotoWithProgress(file: File): Observable<HttpEvent<User>> {
    const form = new FormData();
    form.append('photo', file);
    return this.http.post<User>(`${this.base}/profile/photo`, form, { reportProgress: true, observe: 'events' });
  }
  changePassword(data: { current_password: string; password: string; password_confirmation: string }) {
    return this.http.put<{ message: string }>(`${this.base}/profile/password`, data);
  }
  setAvailability(is_available: boolean): Observable<User> {
    return this.http.patch<User>(`${this.base}/prestataire/availability`, { is_available });
  }

  // --- Catégories ---
  categories(): Observable<Categorie[]> {
    return this.http.get<Categorie[]>(`${this.base}/categories`);
  }
  createCategorie(data: Partial<Categorie>): Observable<Categorie> {
    return this.http.post<Categorie>(`${this.base}/admin/categories`, data);
  }
  updateCategorie(id: number, data: Partial<Categorie>): Observable<Categorie> {
    return this.http.put<Categorie>(`${this.base}/admin/categories/${id}`, data);
  }
  deleteCategorie(id: number) {
    return this.http.delete<{ message: string }>(`${this.base}/admin/categories/${id}`);
  }

  // --- TVA ---
  tauxTva(): Observable<TauxTva[]> {
    return this.http.get<TauxTva[]>(`${this.base}/taux-tva`);
  }
  saveTauxTva(data: { libelle: string; taux: number; par_defaut: boolean }, id?: number): Observable<TauxTva> {
    return id
      ? this.http.put<TauxTva>(`${this.base}/admin/taux-tva/${id}`, data)
      : this.http.post<TauxTva>(`${this.base}/admin/taux-tva`, data);
  }
  deleteTauxTva(id: number) {
    return this.http.delete<{ message: string }>(`${this.base}/admin/taux-tva/${id}`);
  }

  // --- Prestataires ---
  searchPrestataires(filters: PrestataireSearch = {}): Observable<PrestataireCard[]> {
    return this.http.get<PrestataireCard[]>(`${this.base}/prestataires`, { params: this.params(filters) });
  }
  recommandations(filters: { lat?: number | null; lng?: number | null; categorie_id?: number | null; besoin?: string | null } = {}) {
    return this.http.get<PrestataireCard[]>(`${this.base}/prestataires/recommandations`, { params: this.params(filters) });
  }
  prestataire(id: number): Observable<PrestataireDetail> {
    return this.http.get<PrestataireDetail>(`${this.base}/prestataires/${id}`);
  }

  // --- Rendez-vous ---
  rendezVous(status?: RdvStatus): Observable<RendezVous[]> {
    return this.http.get<RendezVous[]>(`${this.base}/rendez-vous`, { params: this.params({ status }) });
  }
  getRendezVous(id: number): Observable<RendezVous> {
    return this.http.get<RendezVous>(`${this.base}/rendez-vous/${id}`);
  }
  createRendezVous(data: object): Observable<RendezVous> {
    return this.http.post<RendezVous>(`${this.base}/rendez-vous`, data);
  }
  annulerRendezVous(id: number): Observable<RendezVous> {
    return this.http.post<RendezVous>(`${this.base}/rendez-vous/${id}/annuler`, {});
  }
  accepterRendezVous(id: number, heure?: string | null): Observable<RendezVous> {
    return this.http.post<RendezVous>(`${this.base}/rendez-vous/${id}/accepter`, { heure: heure || null });
  }
  refuserRendezVous(id: number, motif?: string | null): Observable<RendezVous> {
    return this.http.post<RendezVous>(`${this.base}/rendez-vous/${id}/refuser`, { motif: motif || null });
  }
  modifierHoraire(id: number, heure: string, date?: string | null): Observable<RendezVous> {
    return this.http.patch<RendezVous>(`${this.base}/rendez-vous/${id}/horaire`, { heure, date: date || undefined });
  }
  terminerRendezVous(id: number): Observable<RendezVous> {
    return this.http.post<RendezVous>(`${this.base}/rendez-vous/${id}/terminer`, {});
  }
  genererFacture(id: number, montant: number, details?: string | null): Observable<Facture> {
    return this.http.post<Facture>(`${this.base}/rendez-vous/${id}/facture`, { montant, details: details || null });
  }

  // --- Factures & paiements ---
  factures(): Observable<Facture[]> {
    return this.http.get<Facture[]>(`${this.base}/factures`);
  }
  facture(id: number): Observable<Facture> {
    return this.http.get<Facture>(`${this.base}/factures/${id}`);
  }
  /** Export admin (CSV ou Excel), dans la langue de l'interface. */
  adminExport(params: { type: string; format: 'csv' | 'xlsx'; du?: string | null; au?: string | null }): Observable<Blob> {
    return this.http.get(`${this.base}/admin/export`, { params: this.params(params), responseType: 'blob' });
  }
  facturePdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/factures/${id}/pdf`, { responseType: 'blob' });
  }
  payerFacture(id: number, data: { mode: 'en_ligne' | 'especes'; card_number?: string; card_name?: string; expiry?: string; cvv?: string }) {
    return this.http.post<Facture>(`${this.base}/factures/${id}/payer`, data);
  }
  confirmerEspeces(id: number): Observable<Facture> {
    return this.http.post<Facture>(`${this.base}/factures/${id}/confirmer-especes`, {});
  }
  /** Prestataire : espèces reçues sur place, sans déclaration préalable du client. */
  encaisserEspeces(id: number): Observable<Facture> {
    return this.http.post<Facture>(`${this.base}/factures/${id}/encaisser-especes`, {});
  }
  /** Prestataire : espèces déclarées mais non reçues. */
  refuserEspeces(id: number): Observable<Facture> {
    return this.http.post<Facture>(`${this.base}/factures/${id}/refuser-especes`, {});
  }
  /** Client : retire sa déclaration de paiement en espèces. */
  annulerEspeces(id: number): Observable<Facture> {
    return this.http.post<Facture>(`${this.base}/factures/${id}/annuler-especes`, {});
  }

  // --- Tableaux de bord ---
  clientDashboard(): Observable<ClientDashboard> {
    return this.http.get<ClientDashboard>(`${this.base}/client/dashboard`);
  }
  prestataireDashboard(): Observable<PrestataireDashboard> {
    return this.http.get<PrestataireDashboard>(`${this.base}/prestataire/dashboard`);
  }
  revenus(): Observable<Revenus> {
    return this.http.get<Revenus>(`${this.base}/prestataire/revenus`);
  }
  calendrier(from: string, to: string): Observable<RendezVous[]> {
    return this.http.get<RendezVous[]>(`${this.base}/prestataire/calendrier`, { params: this.params({ from, to }) });
  }
  adminDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.base}/admin/dashboard`);
  }

  // --- Évaluations ---
  evaluations(): Observable<Evaluation[]> {
    return this.http.get<Evaluation[]>(`${this.base}/evaluations`);
  }
  createEvaluation(data: { rendez_vous_id: number; note: number; commentaire?: string | null }) {
    return this.http.post<Evaluation>(`${this.base}/evaluations`, data);
  }
  updateEvaluation(id: number, data: { note: number; commentaire?: string | null }) {
    return this.http.put<Evaluation>(`${this.base}/evaluations/${id}`, data);
  }
  repondreEvaluation(id: number, reponse: string): Observable<Evaluation> {
    return this.http.post<Evaluation>(`${this.base}/evaluations/${id}/repondre`, { reponse });
  }
  deleteEvaluation(id: number) {
    return this.http.delete<{ message: string }>(`${this.base}/admin/evaluations/${id}`);
  }

  // --- Messagerie ---
  conversations(): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.base}/conversations`);
  }
  openConversation(user_id: number): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.base}/conversations`, { user_id });
  }
  /** Page d'historique : les plus récents par défaut, ou ceux avant beforeId. */
  messages(conversationId: number, beforeId?: number): Observable<Message[]> {
    return this.http.get<Message[]>(`${this.base}/conversations/${conversationId}/messages`, { params: this.params({ before_id: beforeId }) });
  }
  messageUpdates(conversationId: number, afterId: number): Observable<ConversationUpdates> {
    return this.http.get<ConversationUpdates>(`${this.base}/conversations/${conversationId}/updates`, { params: this.params({ after_id: afterId }) });
  }
  typing(conversationId: number): Observable<unknown> {
    return this.http.post(`${this.base}/conversations/${conversationId}/typing`, {});
  }
  /** Texte, pièce jointe (photo ou PDF), ou les deux. */
  sendMessage(conversationId: number, content: string, file?: File | null): Observable<Message> {
    const url = `${this.base}/conversations/${conversationId}/messages`;
    if (!file) return this.http.post<Message>(url, { content });
    const form = new FormData();
    if (content) form.append('content', content);
    form.append('file', file);
    return this.http.post<Message>(url, form);
  }
  /** Pièce jointe d'un message (route protégée par le jeton : chargée en Blob). */
  messageAttachment(path: string): Observable<Blob> {
    return this.http.get(`${this.base}${path}`, { responseType: 'blob' });
  }
  unreadMessages(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/conversations/unread-count`);
  }

  // --- Litiges ---
  litiges(): Observable<Litige[]> {
    return this.http.get<Litige[]>(`${this.base}/litiges`);
  }
  createLitige(data: { rendez_vous_id: number; sujet: string; description: string }) {
    return this.http.post<Litige>(`${this.base}/litiges`, data);
  }
  traiterLitige(id: number, statut: LitigeStatut, reponse_admin?: string | null) {
    return this.http.patch<Litige>(`${this.base}/admin/litiges/${id}`, { statut, reponse_admin: reponse_admin || null });
  }

  // --- Notifications ---
  notifications(): Observable<{ items: AppNotification[]; non_lues: number }> {
    return this.http.get<{ items: AppNotification[]; non_lues: number }>(`${this.base}/notifications`);
  }
  markNotificationRead(id: number) {
    return this.http.post<{ message: string }>(`${this.base}/notifications/${id}/lu`, {});
  }
  markAllNotificationsRead() {
    return this.http.post<{ message: string }>(`${this.base}/notifications/lire-tout`, {});
  }

  // --- Administration ---
  adminUsers(filters: { role?: string; q?: string } = {}): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/users`, { params: this.params(filters) });
  }
  adminPrestataires(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/prestataires`);
  }
  adminValidations(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/admin/validations`);
  }
  validerPrestataire(id: number): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/prestataires/${id}/valider`, {});
  }
  refuserPrestataire(id: number, motif?: string | null): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/prestataires/${id}/refuser`, { motif: motif || null });
  }
  bloquerUser(id: number, data: { type: 'temporaire' | 'definitif'; jusqu_au?: string | null; motif?: string | null }) {
    return this.http.post<User>(`${this.base}/admin/users/${id}/bloquer`, data);
  }
  debloquerUser(id: number): Observable<User> {
    return this.http.post<User>(`${this.base}/admin/users/${id}/debloquer`, {});
  }
  deleteUser(id: number) {
    return this.http.delete<{ message: string }>(`${this.base}/admin/users/${id}`);
  }
}
