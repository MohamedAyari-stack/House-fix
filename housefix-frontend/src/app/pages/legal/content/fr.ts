import { LegalTexts, OPERATOR } from './types';

/** Texte source (français). Les versions arabe et anglaise suivent exactement la même structure. */
export const LEGAL_FR: LegalTexts = {
  privacy: {
    title: 'Politique de confidentialité',
    intro:
      "Cette politique explique quelles données personnelles DarFix collecte, pourquoi, avec qui elles sont partagées et comment exercer vos droits. Elle s'applique à toute personne qui utilise la plateforme, en tant que client, prestataire ou administrateur.",
    sections: [
      {
        id: 'responsable',
        title: 'Responsable du traitement',
        body: [
          `Les données sont traitées par ${OPERATOR.name}, qui exploite la plateforme de mise en relation entre clients et prestataires de services à domicile en Tunisie.`,
          `Pour toute question sur vos données : ${OPERATOR.email}.`,
          'Les traitements respectent la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel.',
        ],
      },
      {
        id: 'donnees',
        title: 'Données collectées',
        body: [
          'Nous collectons uniquement les données nécessaires au fonctionnement du service :',
          [
            "Compte : nom, adresse email, numéro de téléphone, gouvernorat, mot de passe (enregistré sous forme chiffrée, jamais lisible), langue de l'interface, date de vérification de l'email et date d'acceptation des présentes conditions.",
            'Profil (facultatif) : photo, adresse, position géographique (latitude et longitude).',
            'Profil professionnel des prestataires : métier, spécialité, description, années d\'expérience, certifications, tarif horaire, disponibilités, statut de validation.',
            "Rendez-vous : date, heure, description du besoin, adresse et position de l'intervention, statut.",
            'Factures et paiements : montant, mode de paiement, statut. Pour un paiement par carte, seuls les 4 derniers chiffres de la carte sont conservés ; le numéro complet n\'est jamais enregistré.',
            'Échanges : messages entre client et prestataire, évaluations et réponses, litiges et décisions de l\'administration, notifications.',
            'Données techniques : jeton de connexion, adresse IP et navigateur lors des sessions, journaux d\'erreurs du serveur.',
          ],
          "Votre position GPS n'est lue qu'avec votre accord (demande du navigateur) pour calculer les distances ; elle n'est enregistrée que si vous l'ajoutez à votre profil ou à un rendez-vous.",
        ],
      },
      {
        id: 'finalites',
        title: 'Pourquoi nous utilisons vos données',
        body: [
          [
            'Créer et sécuriser votre compte (vérification de l\'email par code, réinitialisation du mot de passe).',
            'Mettre en relation clients et prestataires : recherche, prise de rendez-vous, messagerie, factures, paiements.',
            'Valider les comptes prestataires et modérer les avis et les litiges.',
            'Vous envoyer les emails et notifications liés à votre activité (rendez-vous, factures, comptes, litiges), dans votre langue.',
            'Vous recommander des prestataires adaptés à votre besoin (voir la section suivante).',
            'Assurer la sécurité de la plateforme et prévenir les abus (blocage de comptes, limitation des tentatives).',
          ],
          "Nous ne vendons pas vos données et ne les utilisons pas pour de la publicité.",
        ],
      },
      {
        id: 'recommandation',
        title: 'Recommandation par intelligence artificielle',
        body: [
          "Pour vous proposer des prestataires, un service de recommandation calcule un score à partir de critères explicites : correspondance avec le besoin que vous décrivez, note des clients, distance, tarif, fiabilité, expérience et vos rendez-vous passés. Les raisons de chaque recommandation vous sont affichées.",
          "Ce service reçoit les informations professionnelles des prestataires et votre contexte (gouvernorat, position si vous l'avez partagée, historique de vos rendez-vous terminés) ; il ne reçoit ni votre nom, ni votre email, ni votre numéro de téléphone.",
          "La recommandation est une aide au choix : vous restez libre de choisir n'importe quel prestataire, et elle n'entraîne aucune décision automatique vous concernant.",
        ],
      },
      {
        id: 'partage',
        title: 'Qui peut voir vos données',
        body: [
          [
            "Le prestataire avec qui vous prenez rendez-vous voit les informations nécessaires à l'intervention : nom, téléphone, adresse et description du besoin.",
            "Les clients voient le profil public des prestataires validés : nom, photo, métier, description, tarif, gouvernorat, note et avis.",
            "Sur la page d'accueil publique, les avis sont affichés avec le prénom et l'initiale du nom de leur auteur uniquement.",
            "Les administrateurs de DarFix accèdent aux données nécessaires à la validation des comptes, à la modération et au traitement des litiges.",
            "Un prestataire d'envoi d'emails transmet les emails en notre nom (adresse email, nom et contenu du message).",
          ],
          "Vos données ne sont communiquées à des autorités que si la loi l'exige.",
        ],
      },
      {
        id: 'conservation',
        title: 'Durée de conservation',
        body: [
          [
            "Les données du compte sont conservées tant que le compte existe.",
            'Les codes de vérification sont supprimés dès leur utilisation et expirent après 15 minutes.',
            'Les factures sont conservées pendant la durée imposée par les obligations comptables et fiscales.',
            "À la suppression du compte, les données personnelles sont effacées, sauf celles que la loi impose de conserver.",
          ],
        ],
      },
      {
        id: 'securite',
        title: 'Sécurité',
        body: [
          [
            'Mots de passe et codes de vérification enregistrés uniquement sous forme chiffrée.',
            "Vérification de l'adresse email à l'inscription et code à usage unique pour réinitialiser le mot de passe.",
            'Limitation du nombre de tentatives de connexion et de saisie des codes.',
            'Déconnexion de tous vos appareils après un changement de mot de passe.',
            'Accès aux données limité selon le rôle (client, prestataire, administrateur).',
          ],
        ],
      },
      {
        id: 'stockage-local',
        title: 'Stockage dans votre navigateur',
        body: [
          "DarFix n'utilise pas de cookies publicitaires ni d'outil de mesure d'audience. Le navigateur conserve seulement votre jeton de connexion, votre profil, la langue et le thème choisis, pour vous éviter de vous reconnecter et de refaire vos réglages. Ces informations sont effacées à la déconnexion (sauf la langue et le thème).",
        ],
      },
      {
        id: 'droits',
        title: 'Vos droits',
        body: [
          'Conformément à la loi organique n° 2004-63, vous disposez des droits suivants :',
          [
            "Accès : obtenir la communication des données qui vous concernent.",
            "Rectification : corriger vos données. La plupart sont modifiables directement dans Paramètres.",
            'Opposition : vous opposer, pour un motif légitime, au traitement de vos données.',
            "Suppression : demander la suppression de votre compte et de vos données.",
          ],
          `Pour exercer ces droits, écrivez à ${OPERATOR.email} depuis l'adresse de votre compte. Vous pouvez également saisir l'Instance Nationale de Protection des Données Personnelles (INPDP).`,
        ],
      },
      {
        id: 'mineurs',
        title: 'Mineurs',
        body: ["La plateforme est destinée aux personnes majeures. Nous ne collectons pas sciemment de données concernant des mineurs."],
      },
      {
        id: 'modifications',
        title: 'Modifications de cette politique',
        body: [
          "Nous pouvons mettre à jour cette politique. La date de dernière mise à jour figure en haut de la page ; en cas de changement important, vous en serez informé par email ou par une notification.",
        ],
      },
    ],
  },

  terms: {
    title: "Conditions générales d'utilisation",
    intro:
      "Ces conditions encadrent l'utilisation de DarFix. En créant un compte, vous les acceptez, ainsi que la politique de confidentialité. Si vous ne les acceptez pas, n'utilisez pas la plateforme.",
    sections: [
      {
        id: 'objet',
        title: 'Objet du service',
        body: [
          'DarFix est une plateforme de mise en relation entre des clients et des prestataires de services à domicile (plomberie, électricité, climatisation, serrurerie, menuiserie, peinture, jardinage, nettoyage…) en Tunisie.',
          "DarFix agit comme intermédiaire technique : le contrat de prestation est conclu directement entre le client et le prestataire. DarFix n'est pas partie à ce contrat et n'exécute pas les interventions.",
        ],
      },
      {
        id: 'compte',
        title: 'Création et sécurité du compte',
        body: [
          [
            "L'inscription est gratuite et réservée aux personnes majeures.",
            "Vous devez fournir des informations exactes et vérifier votre adresse email à l'aide du code reçu.",
            "Vous êtes responsable de la confidentialité de votre mot de passe et de l'activité de votre compte. Signalez-nous tout usage non autorisé.",
            'Un compte est personnel et ne peut pas être cédé.',
          ],
        ],
      },
      {
        id: 'prestataires',
        title: 'Obligations des prestataires',
        body: [
          [
            "Un compte prestataire n'apparaît dans les recherches qu'après validation par l'administration. Cette validation porte sur la cohérence du profil ; elle ne garantit pas la qualité des travaux.",
            'Le prestataire décrit honnêtement ses compétences, son expérience, ses certifications et son tarif.',
            "Il exerce dans le respect de la réglementation applicable à son activité (autorisations, assurances, obligations fiscales) et reste seul responsable de ses interventions.",
            "Il répond aux demandes dans un délai raisonnable, honore les rendez-vous acceptés et établit une facture correspondant à l'intervention réalisée.",
          ],
        ],
      },
      {
        id: 'rendez-vous',
        title: 'Rendez-vous',
        body: [
          [
            "Le client envoie une demande avec la date, l'adresse et la description du besoin ; le prestataire l'accepte, la refuse ou propose un autre horaire.",
            "Le client peut annuler un rendez-vous tant qu'il est en attente ou accepté, c'est-à-dire avant que l'intervention soit marquée comme terminée.",
            "Une fois l'intervention terminée, le prestataire émet la facture depuis la plateforme.",
          ],
        ],
      },
      {
        id: 'paiement',
        title: 'Tarifs et paiement',
        body: [
          [
            "Le tarif horaire affiché par le prestataire est indicatif ; le montant dû est celui de la facture.",
            "La facture se règle en ligne par carte bancaire ou en espèces. Un paiement en espèces est confirmé par le prestataire.",
            "L'inscription et l'utilisation de la plateforme sont gratuites pour les clients.",
          ],
        ],
      },
      {
        id: 'avis',
        title: 'Avis et évaluations',
        body: [
          [
            "Seul un client dont l'intervention est terminée peut évaluer le prestataire.",
            "Les avis doivent être sincères, respectueux et porter sur l'intervention. Le prestataire peut y répondre.",
            "L'administration peut supprimer un avis injurieux, diffamatoire, hors sujet ou trompeur.",
          ],
        ],
      },
      {
        id: 'messagerie',
        title: 'Messagerie',
        body: [
          'La messagerie sert aux échanges liés aux prestations. Il est interdit de l\'utiliser pour du démarchage, du harcèlement ou des contenus illicites.',
        ],
      },
      {
        id: 'litiges',
        title: 'Litiges',
        body: [
          "En cas de problème lié à un rendez-vous, client et prestataire peuvent déclarer un litige depuis la plateforme. L'administration examine la situation et peut proposer une solution, sans se substituer aux recours légaux des parties.",
        ],
      },
      {
        id: 'comportements',
        title: 'Comportements interdits',
        body: [
          [
            "Fournir de fausses informations ou usurper l'identité d'un tiers.",
            "Publier des contenus injurieux, discriminatoires, diffamatoires ou illicites.",
            'Contourner la plateforme pour éviter une facture déjà engagée, ou manipuler les avis.',
            'Tenter de perturber le service ou d\'accéder aux données d\'autres utilisateurs.',
          ],
        ],
      },
      {
        id: 'sanctions',
        title: 'Suspension et suppression de compte',
        body: [
          "En cas de manquement à ces conditions, l'administration peut bloquer un compte temporairement ou définitivement, avec un motif communiqué à l'utilisateur, voire le supprimer. Vous pouvez demander la suppression de votre compte à tout moment (voir la politique de confidentialité).",
        ],
      },
      {
        id: 'ia',
        title: 'Recommandations',
        body: [
          "Les prestataires recommandés et leur score de compatibilité sont calculés automatiquement à titre indicatif. Ils ne constituent ni une garantie ni un classement officiel ; le choix du prestataire vous appartient.",
        ],
      },
      {
        id: 'responsabilite',
        title: 'Responsabilité',
        body: [
          "DarFix met tout en œuvre pour assurer la disponibilité et la sécurité de la plateforme, sans pouvoir garantir un fonctionnement sans interruption. DarFix n'est pas responsable de l'exécution, de la qualité ou des conséquences des prestations réalisées par les prestataires.",
        ],
      },
      {
        id: 'propriete',
        title: 'Propriété intellectuelle',
        body: [
          "La plateforme (nom, logo, interface, code) appartient à son exploitant. Vous conservez les droits sur les contenus que vous publiez (photos, descriptions, avis) et autorisez DarFix à les afficher sur la plateforme pour les besoins du service.",
        ],
      },
      {
        id: 'donnees',
        title: 'Données personnelles',
        body: ['Le traitement de vos données est décrit dans la politique de confidentialité, qui fait partie de ces conditions.'],
      },
      {
        id: 'modifications',
        title: 'Modification des conditions',
        body: [
          "Ces conditions peuvent évoluer. La date de dernière mise à jour figure en haut de la page ; en cas de changement important, les utilisateurs en sont informés et peuvent être invités à les accepter de nouveau.",
        ],
      },
      {
        id: 'droit',
        title: 'Droit applicable',
        body: [
          `Ces conditions sont soumises au droit tunisien. En cas de différend, les parties recherchent d'abord une solution amiable ; à défaut, les tribunaux tunisiens compétents sont saisis. Contact : ${OPERATOR.email}.`,
        ],
      },
    ],
  },
};
