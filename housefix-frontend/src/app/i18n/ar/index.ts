import type { FR } from '../fr';
import { accueil } from './accueil';
import { admin } from './admin';
import { auth } from './auth';
import { client } from './client';
import { common } from './common';
import { layout } from './layout';
import { legal } from './legal';
import { pages } from './pages';
import { prestataire } from './prestataire';
import { services } from './services';

/** Dictionnaire arabe : même forme que le français (une clé manquante ne compile pas). */
export const AR: typeof FR = { common, auth, accueil, layout, client, prestataire, admin, pages, legal, services };
