import { formatNumber } from '@angular/common';
import {
  Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Conversation, Message } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { errorMessage, fieldErrors } from '../../core/utils';
import { currentLocale, translate } from '../../i18n/i18n';
import { I18N } from '../../i18n/pipes';
import { Avatar } from '../../shared/avatar';
import { MessageAttachmentView } from '../../shared/message-attachment';

/** Pièces jointes acceptées : les mêmes règles que Laravel (ConversationController::ATTACHMENT_RULES). */
const ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const ATTACHMENT_MAX = 5 * 1024 * 1024;
const MAX_LENGTH = 2000;
/** Rafraîchissement de la conversation ouverte et de la liste (en pause quand l'onglet est caché). */
const UPDATES_MS = 4000;
const LIST_MS = 15000;
/** Signal « en train d'écrire » renvoyé au plus toutes les 3 s pendant la saisie. */
const TYPING_MS = 3000;
/** Deux messages du même auteur à moins de 5 min forment un groupe (bulles rapprochées). */
const GROUP_MS = 5 * 60 * 1000;

interface PendingFile {
  file: File;
  preview: string | null;
}

@Component({
  standalone: true,
  selector: 'app-messages',
  imports: [FormsModule, RouterLink, Avatar, MessageAttachmentView, ...I18N],
  templateUrl: './messages.html',
  styleUrl: './messages.css',
})
export class Messages {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('composer');

  protected readonly maxLength = MAX_LENGTH;
  protected readonly meId = computed(() => this.auth.user()?.id ?? 0);
  protected readonly myRole = computed(() => this.auth.role());
  protected readonly loadingList = signal(true);
  protected readonly loadingMessages = signal(false);
  protected readonly loadingOlder = signal(false);
  protected readonly hasOlder = signal(false);
  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly activeId = signal<number | null>(null);
  protected readonly messages = signal<Message[]>([]);
  protected readonly sending = signal(false);
  protected readonly search = signal('');
  protected readonly otherTyping = signal(false);
  protected readonly newBelow = signal(0);
  protected readonly pending = signal<PendingFile | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly dragging = signal(false);
  protected draft = '';

  /** Aperçus locaux des photos que je viens d'envoyer (id du message → URL), pour ne pas les retélécharger. */
  protected readonly localPreviews = new Map<number, string>();
  private lastTypingSent = 0;
  private dragDepth = 0;

  protected readonly active = computed(() => this.conversations().find((c) => c.id === this.activeId()) ?? null);
  protected readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.conversations().filter((c) => c.other_user.nom.toLowerCase().includes(q)) : this.conversations();
  });

  constructor() {
    this.loadConversations();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const userId = Number(params.get('user'));
      if (userId) this.openWith(userId);
    });

    // Polling en pause quand l'onglet est caché : pas de requêtes inutiles, reprise immédiate au retour.
    const visible = () => document.visibilityState === 'visible';
    const listTimer = setInterval(() => visible() && this.loadConversations(), LIST_MS);
    const updatesTimer = setInterval(() => visible() && this.pollUpdates(), UPDATES_MS);
    const onVisible = () => visible() && this.pollUpdates();
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(listTimer);
      clearInterval(updatesTimer);
      document.removeEventListener('visibilitychange', onVisible);
      this.clearPending();
      this.localPreviews.forEach((url) => URL.revokeObjectURL(url));
    });
  }

  // ---------- Conversations ----------

  private loadConversations(): void {
    this.api.conversations().subscribe({
      next: (list) => {
        // La conversation ouverte est déjà lue : on n'affiche pas de badge pour elle.
        const active = this.activeId();
        const merged = list.map((c) => (c.id === active ? { ...c, unread_count: 0 } : c));
        // Conserver une conversation fraîchement créée (sans message) absente de la liste serveur.
        const current = this.conversations().find((c) => c.id === active);
        if (current && !merged.some((c) => c.id === active)) merged.unshift(current);
        this.conversations.set(merged);
        this.loadingList.set(false);
      },
      error: (err) => {
        if (this.loadingList()) this.toast.error(errorMessage(err));
        this.loadingList.set(false);
      },
    });
  }

  /** Ouvre (ou crée) la conversation avec un utilisateur donné (?user=ID). */
  private openWith(userId: number): void {
    this.api.openConversation(userId).subscribe({
      next: (conv) => {
        this.conversations.update((list) => [conv, ...list.filter((c) => c.id !== conv.id)]);
        this.select(conv);
        // Nettoie l'URL pour ne pas rouvrir la conversation à chaque rafraîchissement.
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
      },
      error: (err) => this.toast.error(errorMessage(err, translate('pages.messages.errors.open'))),
    });
  }

  protected select(conv: Conversation): void {
    if (this.activeId() !== conv.id) {
      this.messages.set([]);
      this.draft = '';
      this.clearPending();
      this.otherTyping.set(false);
      this.newBelow.set(0);
    }
    this.activeId.set(conv.id);
    this.conversations.update((list) => list.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c)));
    this.loadLatest(conv.id);
  }

  protected back(): void {
    this.activeId.set(null);
    this.messages.set([]);
    this.clearPending();
  }

  // ---------- Messages ----------

  /** Dernière page de l'historique (30 messages). */
  private loadLatest(id: number): void {
    this.loadingMessages.set(true);
    this.api.messages(id).subscribe({
      next: (msgs) => {
        if (this.activeId() !== id) return;
        this.messages.set(msgs);
        this.hasOlder.set(msgs.length >= 30);
        this.loadingMessages.set(false);
        this.scrollToBottom();
      },
      error: (err) => {
        this.loadingMessages.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  /** Page précédente, en gardant le message visible à sa place (pas de saut de l'affichage). */
  protected loadOlder(): void {
    const id = this.activeId();
    const first = this.messages()[0];
    if (!id || !first || this.loadingOlder() || !this.hasOlder()) return;
    const el = this.scroller()?.nativeElement;
    const fromBottom = el ? el.scrollHeight - el.scrollTop : 0;
    this.loadingOlder.set(true);
    this.api.messages(id, first.id).subscribe({
      next: (older) => {
        this.loadingOlder.set(false);
        if (this.activeId() !== id) return;
        this.hasOlder.set(older.length >= 30);
        this.messages.update((list) => [...older, ...list]);
        afterNextRender(() => el && (el.scrollTop = el.scrollHeight - fromBottom), { injector: this.injector });
      },
      error: () => this.loadingOlder.set(false),
    });
  }

  protected onScroll(): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    if (el.scrollTop < 60) this.loadOlder();
    if (this.nearBottom()) this.newBelow.set(0);
  }

  /** Nouveaux messages, accusés de lecture et « en train d'écrire » depuis le dernier message connu. */
  private pollUpdates(): void {
    const id = this.activeId();
    if (!id || this.loadingMessages()) return;
    const afterId = this.messages().at(-1)?.id ?? 0;
    this.api.messageUpdates(id, afterId).subscribe({
      next: (u) => {
        if (this.activeId() !== id) return;
        this.otherTyping.set(u.typing);
        const known = new Set(this.messages().map((m) => m.id));
        const fresh = u.messages.filter((m) => !known.has(m.id));
        const stickToBottom = this.nearBottom();
        this.messages.update((list) =>
          [...list, ...fresh].map((m) =>
            m.sender_id === this.meId() && !m.is_read && u.last_read_id !== null && m.id <= u.last_read_id ? { ...m, is_read: true } : m,
          ),
        );
        if (fresh.length) {
          const last = fresh.at(-1)!;
          this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, last_message: last, updated_at: last.created_at } : c)));
          if (stickToBottom) this.scrollToBottom();
          else this.newBelow.update((n) => n + fresh.filter((m) => m.sender_id !== this.meId()).length);
        }
      },
    });
  }

  protected send(): void {
    const id = this.activeId();
    const content = this.draft.trim();
    const pending = this.pending();
    if (!id || (!content && !pending) || this.sending() || content.length > MAX_LENGTH) return;
    this.sending.set(true);
    this.api.sendMessage(id, content, pending?.file).subscribe({
      next: (msg) => {
        this.sending.set(false);
        this.draft = '';
        this.autosize();
        // L'aperçu local sert d'image au message envoyé (pas de nouveau téléchargement).
        if (pending?.preview) this.localPreviews.set(msg.id, pending.preview);
        this.pending.set(null);
        this.messages.update((list) => [...list, msg]);
        this.conversations.update((list) => {
          const conv = list.find((c) => c.id === id);
          if (!conv) return list;
          return [{ ...conv, last_message: msg, updated_at: msg.created_at }, ...list.filter((c) => c.id !== id)];
        });
        this.scrollToBottom();
      },
      error: (err) => {
        this.sending.set(false);
        const fields = fieldErrors(err);
        if (fields['file']) this.fileError.set(fields['file']);
        else this.toast.error(errorMessage(err, translate('pages.messages.errors.send')));
      },
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected onInput(): void {
    this.autosize();
    const id = this.activeId();
    const now = Date.now();
    if (id && this.draft.trim() && now - this.lastTypingSent > TYPING_MS) {
      this.lastTypingSent = now;
      this.api.typing(id).subscribe({ error: () => undefined });
    }
  }

  // ---------- Pièces jointes ----------

  protected chooseFile(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) this.attach(file);
  }

  /** Une capture collée (Ctrl+V) devient une pièce jointe. */
  protected onPaste(event: ClipboardEvent): void {
    const file = [...(event.clipboardData?.files ?? [])][0];
    if (file) {
      event.preventDefault();
      this.attach(file);
    }
  }

  protected onDragEnter(event: DragEvent): void {
    if (!this.hasFiles(event) || !this.activeId()) return;
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  protected onDragOver(event: DragEvent): void {
    if (this.hasFiles(event)) event.preventDefault();
  }

  protected onDragLeave(event: DragEvent): void {
    if (!this.hasFiles(event)) return;
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (!this.dragDepth) this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && this.activeId()) this.attach(file);
  }

  protected removePending(): void {
    this.clearPending();
    this.fileError.set(null);
  }

  private attach(file: File): void {
    this.fileError.set(null);
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      this.fileError.set(translate('pages.messages.fileErrors.type'));
      return;
    }
    if (file.size > ATTACHMENT_MAX) {
      this.fileError.set(translate('pages.messages.fileErrors.size', { size: formatNumber(file.size / 1024 / 1024, currentLocale(), '1.1-1') }));
      return;
    }
    this.clearPending();
    this.pending.set({ file, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    this.textarea()?.nativeElement.focus();
  }

  private clearPending(): void {
    const p = this.pending();
    // Une photo envoyée garde son URL (affichée dans le fil) ; une photo abandonnée est libérée.
    if (p?.preview && ![...this.localPreviews.values()].includes(p.preview)) URL.revokeObjectURL(p.preview);
    this.pending.set(null);
  }

  private hasFiles(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  // ---------- Affichage ----------

  private nearBottom(): boolean {
    const el = this.scroller()?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  protected jumpToLatest(): void {
    this.newBelow.set(0);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    afterNextRender(
      () => {
        const el = this.scroller()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      },
      { injector: this.injector },
    );
  }

  /** Zone de saisie qui grandit avec le texte (5 lignes au plus). */
  private autosize(): void {
    afterNextRender(
      () => {
        const el = this.textarea()?.nativeElement;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
      },
      { injector: this.injector },
    );
  }

  protected isToday(iso: string | null | undefined): boolean {
    if (!iso) return false;
    return new Date(iso).toDateString() === new Date().toDateString();
  }

  /** Séparateur de jour avant le premier message d'une nouvelle date. */
  protected newDay(index: number): boolean {
    const list = this.messages();
    if (index === 0) return true;
    return new Date(list[index]!.created_at).toDateString() !== new Date(list[index - 1]!.created_at).toDateString();
  }

  /** Message dans la continuité du précédent (même auteur, moins de 5 min) : bulle rapprochée, sans heure répétée. */
  protected continues(index: number): boolean {
    const list = this.messages();
    if (index === 0 || this.newDay(index)) return false;
    const prev = list[index - 1]!;
    const cur = list[index]!;
    return prev.sender_id === cur.sender_id && Date.parse(cur.created_at) - Date.parse(prev.created_at) < GROUP_MS;
  }

  /** Prochain message du même groupe : l'heure n'est affichée que sur le dernier. */
  protected groupContinuesAfter(index: number): boolean {
    return index + 1 < this.messages().length && this.continues(index + 1);
  }

  protected previewKey(m: Message | null): string | null {
    if (!m || m.content) return null;
    return m.type === 'image' ? 'pages.messages.photo' : m.type === 'file' ? 'pages.messages.document' : null;
  }

  protected profileLink(conv: Conversation): string[] | null {
    return this.myRole() === 'client' && conv.other_user.role === 'prestataire' ? ['/client/prestataires', String(conv.other_user.id)] : null;
  }
}
