import { translate } from '../i18n/i18n';

// Types partagés, alignés sur le contrat d'API (docs/API.md).

export type Role = 'client' | 'prestataire' | 'admin';

export type RdvStatus = 'en_attente' | 'accepte' | 'refuse' | 'annule_par_client' | 'termine' | 'facture';

export type StatutPaiement = 'non_payee' | 'en_attente' | 'payee';

export type LitigeStatut = 'ouvert' | 'en_cours' | 'resolu' | 'rejete';

export interface CategorieRef {
  id: number;
  nom: string;
}

export interface Categorie extends CategorieRef {
  /** URL de la page publique : /services/{slug}. */
  slug?: string;
  description: string | null;
  nom_fr?: string;
  nom_ar?: string | null;
  description_fr?: string | null;
  description_ar?: string | null;
  nom_en?: string | null;
  description_en?: string | null;
  icone: string | null;
  prestataires_count: number;
  /** null : le taux par défaut s'applique. */
  taux_tva_id?: number | null;
  /** Taux réellement appliqué aux factures de ce service (en %). */
  taux_tva?: number;
}

/** Taux de TVA géré par l'administrateur. */
export interface TauxTva {
  id: number;
  libelle: string;
  taux: number;
  par_defaut: boolean;
  categories_count: number;
}

export interface PrestataireProfile {
  id: number;
  user_id: number;
  categorie_service_id: number | null;
  categorie: CategorieRef | null;
  specialite: string | null;
  description: string | null;
  experience_annees: number | null;
  certifications: string | null;
  tarif_horaire: number | null;
  is_available: boolean;
  disponibilites: string | null;
  note_moyenne: number;
  nb_avis: number;
  validation_status: 'en_attente' | 'valide' | 'refuse';
}

export interface User {
  id: number;
  nom: string;
  email: string;
  telephone: string | null;
  gouvernorat: string | null;
  role: Role;
  statut: 'actif' | 'suspendu' | 'bloque';
  is_verified: boolean;
  is_blocked: boolean;
  blocked_until: string | null;
  block_motif: string | null;
  photo_url: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  prestataire: PrestataireProfile | null;
}

export interface PrestataireCard extends User {
  distance_km: number | null;
  score: number;
  /** Pourquoi ce prestataire est recommandé (service IA) ; vide avec la formule locale. */
  raisons?: string[];
  /** « ia » : classé par le service de recommandation ; « local » : formule de secours. */
  source?: 'ia' | 'local';
  modele?: 'expert' | 'appris' | null;
  /** Distance ≤ 8 km, ≥ 10 rendez-vous acceptés et note 5/5 : calculé par le serveur. */
  is_recommended?: boolean;
  rdv_acceptes?: number;
}

export interface PrestataireDetail extends User {
  evaluations: Evaluation[];
  is_recommended?: boolean;
  rdv_acceptes?: number;
}

export interface UserRef {
  id: number;
  nom: string;
  telephone?: string | null;
  photo_url?: string | null;
  role?: Role;
}

export interface RendezVous {
  id: number;
  client_id: number;
  prestataire_id: number;
  categorie_service_id: number;
  date: string;
  heure: string | null;
  description: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: RdvStatus;
  motif_refus: string | null;
  created_at: string;
  client: UserRef;
  prestataire: UserRef;
  categorie: CategorieRef;
  facture: Facture | null;
  evaluation: Evaluation | null;
}

export interface Paiement {
  id: number;
  facture_id: number;
  montant: number;
  mode: 'en_ligne' | 'especes';
  statut: 'en_attente' | 'valide' | 'refuse' | 'annule';
  reference: string;
  created_at: string;
}

export interface Facture {
  id: number;
  numero: string;
  rendez_vous_id: number;
  client_id: number;
  prestataire_id: number;
  /** Montant à payer (TTC). Tous les montants sont calculés par le serveur. */
  montant: number;
  montant_ht: number;
  /** Taux appliqué, figé sur la facture (en %). */
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  details: string | null;
  date: string;
  statut_paiement: StatutPaiement;
  mode_paiement: 'en_ligne' | 'especes' | null;
  paid_at: string | null;
  rendez_vous?: RendezVous;
  paiements?: Paiement[];
}

export interface Evaluation {
  id: number;
  rendez_vous_id: number;
  client_id: number;
  prestataire_id: number;
  note: number;
  commentaire: string | null;
  reponse: string | null;
  created_at: string;
  client?: UserRef;
  prestataire?: UserRef;
}

export interface MessageAttachment {
  name: string;
  mime: string;
  size: number;
  /** Route API protégée (/messages/{id}/attachment) : le fichier n'est lisible que par les deux participants. */
  url: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  /** Peut être vide pour une photo ou un document envoyé seul. */
  content: string | null;
  type: 'text' | 'image' | 'file';
  is_read: boolean;
  attachment: MessageAttachment | null;
  created_at: string;
}

/** Réponse du rafraîchissement d'une conversation ouverte (GET /conversations/{id}/updates). */
export interface ConversationUpdates {
  messages: Message[];
  /** Mes messages jusqu'à cet id ont été lus (✓✓). */
  last_read_id: number | null;
  typing: boolean;
}

export interface Conversation {
  id: number;
  client_id: number;
  prestataire_id: number;
  other_user: UserRef;
  last_message: Message | null;
  unread_count: number;
  updated_at: string;
}

export interface Litige {
  id: number;
  rendez_vous_id: number;
  declarant_id: number;
  cible_id: number;
  sujet: string;
  description: string;
  statut: LitigeStatut;
  reponse_admin: string | null;
  traite_par: number | null;
  traite_le: string | null;
  created_at: string;
  declarant: UserRef;
  cible: UserRef;
  rendez_vous: { id: number; date: string; categorie: CategorieRef };
}

export interface AppNotification {
  id: number;
  titre: string;
  message: string;
  type: string;
  lien: string | null;
  lu: boolean;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** Service dans la liste publique (GET /services). */
export interface ServiceSummary {
  id: number;
  slug: string;
  nom: string;
  icone: string | null;
  description?: string | null;
  prestataires?: number;
  tarif_min?: number | null;
  note_moyenne?: number | null;
}

/** Page publique d'un service (GET /services/{slug}?gouvernorat=) : aucune donnée personnelle. */
export interface ServicePageData {
  service: ServiceSummary & { description: string | null };
  gouvernorat: string | null;
  stats: {
    prestataires: number;
    disponibles: number;
    note_moyenne: number | null;
    avis: number;
    interventions: number;
    tarif_min: number | null;
    tarif_median: number | null;
    tarif_max: number | null;
  };
  gouvernorats: { nom: string; prestataires: number }[];
  prestataires: {
    id: number;
    nom: string;
    photo_url: string | null;
    gouvernorat: string;
    specialite: string | null;
    experience_annees: number;
    tarif_horaire: number;
    note_moyenne: number;
    nb_avis: number;
    disponible: boolean;
  }[];
  avis: { note: number; commentaire: string; auteur: string; gouvernorat: string | null; date: string | null }[];
  autres_services: ServiceSummary[];
}

/** Données publiques de la page d'accueil (GET /accueil) : aucune donnée personnelle. */
export interface Accueil {
  stats: { prestataires: number; interventions: number; note_moyenne: number; avis: number; gouvernorats: number };
  categories: Categorie[];
  top_prestataires: {
    id: number;
    nom: string;
    photo_url: string | null;
    gouvernorat: string;
    categorie: string | null;
    specialite: string | null;
    experience_annees: number;
    tarif_horaire: number;
    note_moyenne: number;
    nb_avis: number;
  }[];
  avis: { note: number; commentaire: string; auteur: string; gouvernorat: string | null; categorie: string | null }[];
}

/** Inscription : pas de jeton tant que l'email n'est pas vérifié avec le code reçu. */
export interface RegisterResponse {
  message: string;
  email: string;
  email_sent: boolean;
}

export interface ClientDashboard {
  interventions_terminees: number;
  categories_actives: number;
  rdv_en_cours: number;
  factures_impayees: number;
  prochain_rdv: RendezVous | null;
  progression: number;
}

export interface PrestataireDashboard {
  revenus_jour: number;
  revenus_hier: number;
  revenus_semaine: number;
  revenus_semaine_derniere: number;
  jobs_termines_semaine: number;
  note_moyenne: number;
  nb_avis: number;
  demandes_en_attente: number;
  interventions_du_jour: RendezVous[];
  prochaine_intervention: RendezVous | null;
}

export interface Revenus {
  total: number;
  mois_courant: number;
  mois_dernier: number;
  evolution_pct: number;
  mensuel: { mois: string; label: string; total: number }[];
}

export interface AdminDashboard {
  clients_inscrits: number;
  prestataires_actifs: number;
  prestataires_en_attente: number;
  total_rdv: number;
  moyenne_evaluations: number;
  nb_avis: number;
  litiges_ouverts: number;
  chiffre_affaires: number;
  chiffre_affaires_ht: number;
  tva_collectee: number;
  statuts: { status: RdvStatus; count: number }[];
  rdv_par_mois: { label: string; total: number }[];
}

export interface PrestataireSearch {
  q?: string;
  categorie_id?: number | null;
  gouvernorat?: string;
  min_note?: number | null;
  max_tarif?: number | null;
  disponible?: boolean;
  lat?: number | null;
  lng?: number | null;
  sort?: 'recommande' | 'note' | 'prix' | 'distance';
}

export const GOUVERNORATS = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
];

/** Statuts dans l'ordre d'affichage (filtres). Libellés traduits : rdvStatusLabel(), etc. */
export const RDV_STATUSES: RdvStatus[] = ['en_attente', 'accepte', 'refuse', 'annule_par_client', 'termine', 'facture'];
export const LITIGE_STATUTS: LitigeStatut[] = ['ouvert', 'en_cours', 'resolu', 'rejete'];

export const rdvStatusLabel = (s: string): string => translate(`common.status.rdv.${s}`);
export const litigeStatutLabel = (s: string): string => translate(`common.status.litige.${s}`);
export const paiementLabel = (s: string): string => translate(`common.status.paiement.${s}`);
export const roleLabel = (r: string): string => translate(`common.roles.${r}`);
/** Nom affiché d'un gouvernorat ; la valeur stockée et envoyée à l'API reste le nom français. */
export const gouvernoratLabel = (g: string | null | undefined): string => (g ? translate(`common.gouvernorats.${g}`) : '');
