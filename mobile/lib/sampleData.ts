/**
 * Données de démonstration — famille DUPONT (fictive, francophone).
 * 28 personnes sur 5 générations (~1882 → 2004). Noms inventés.
 *
 * Pensé pour exercer l'UI : remariage (Robert), enfant unique (Odette, Suzanne,
 * Hugo), fratries nombreuses, longévité (Odette/Joséphine ~91 ans), couple sans
 * enfants (Yvonne × Jean), fiche sans date (Vincent), fiche sans bio (Brigitte).
 *
 * ⚠️ Généré — ne pas éditer à la main. Données 100 % fictives (aucun lien avec
 * de vraies personnes ni avec l'arbre TEDA de production).
 */
import type { FamilyTree, JournalEntry, Person, Relationship, TreeSettings } from './types';

export const samplePersons: Person[] = [
  {
    "id": "p1",
    "firstName": "Augustin",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1882-03-04",
    "deathDate": "1955-11-20",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Menuisier",
    "bio": "Patriarche de la famille, Augustin tenait un atelier de menuiserie réputé dans le Vieux Lyon. Homme de peu de mots mais d'un grand sens du devoir, il a transmis le goût du travail bien fait à toute sa descendance.",
    "tags": [
      "fondateur",
      "artisan"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p2",
    "firstName": "Henriette",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": false,
    "maidenName": "Lemoine",
    "birthDate": "1885-07-19",
    "deathDate": "1968-02-11",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Couturière",
    "bio": "Henriette cousait pour les grandes maisons de soie lyonnaises. Femme de caractère, elle a tenu la maison familiale pendant les deux guerres et élevé trois enfants.",
    "tags": [
      "couturière"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p3",
    "firstName": "Camille",
    "lastName": "Rousseau",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1884-09-30",
    "deathDate": "1944-06-08",
    "birthPlace": {
      "city": "Annecy",
      "country": "France"
    },
    "occupation": "Instituteur",
    "bio": "Instituteur de village dévoué, Camille a appris à lire à plusieurs générations d'Annéciens. Il est mort pendant l'Occupation, laissant le souvenir d'un homme juste.",
    "tags": [
      "enseignant"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p4",
    "firstName": "Joséphine",
    "lastName": "Rousseau",
    "gender": "female",
    "isAlive": false,
    "maidenName": "Berger",
    "birthDate": "1888-12-02",
    "deathDate": "1979-04-15",
    "birthPlace": {
      "city": "Annecy",
      "country": "France"
    },
    "bio": "Joséphine a vécu près de quatre-vingt-onze ans, traversant tout le XXe siècle. Veuve très tôt, elle a élevé seule sa fille unique avec une douceur inébranlable.",
    "tags": [
      "longévité"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p5",
    "firstName": "Marcel",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1909-04-12",
    "deathDate": "1981-10-03",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Cheminot",
    "bio": "Fils aîné d'Augustin, Marcel a fait toute sa carrière à la SNCF. Passionné de mécanique, il réparait les horloges du quartier le dimanche.",
    "tags": [
      "cheminot"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p6",
    "firstName": "Germaine",
    "lastName": "Caron",
    "gender": "female",
    "isAlive": false,
    "maidenName": "Dupont",
    "birthDate": "1912-08-22",
    "deathDate": "1990-01-30",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Infirmière",
    "bio": "Germaine fut infirmière de la Croix-Rouge durant la Seconde Guerre mondiale. Sa générosité était connue de tout le voisinage.",
    "tags": [
      "infirmière"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p7",
    "firstName": "Lucien",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1915-05-09",
    "deathDate": "1944-08-17",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Soldat",
    "bio": "Benjamin de la fratrie, Lucien est tombé à vingt-neuf ans lors de la Libération, célibataire et sans enfant. Son nom figure sur le monument aux morts de sa commune.",
    "tags": [
      "mémoire"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p8",
    "firstName": "Odette",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": false,
    "maidenName": "Rousseau",
    "birthDate": "1912-06-17",
    "deathDate": "2003-09-25",
    "birthPlace": {
      "city": "Annecy",
      "country": "France"
    },
    "occupation": "Libraire",
    "bio": "Fille unique de Camille et Joséphine, Odette a tenu une petite librairie pendant quarante ans. Doyenne de la famille, elle s'est éteinte à quatre-vingt-onze ans, entourée de ses petits-enfants.",
    "tags": [
      "libraire",
      "longévité"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p9",
    "firstName": "Fernand",
    "lastName": "Caron",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1910-02-28",
    "deathDate": "1978-07-14",
    "birthPlace": {
      "city": "Grenoble",
      "country": "France"
    },
    "occupation": "Pharmacien",
    "bio": "Fernand tenait l'officine du centre de Grenoble. Discret et méthodique, il épousa Germaine en 1937.",
    "tags": [
      "pharmacien"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p10",
    "firstName": "Robert",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthDate": "1938-02-14",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Ingénieur",
    "bio": "Robert a fait carrière dans l'aéronautique à Toulouse. Veuf de Monique en 1995, il s'est remarié avec Colette deux ans plus tard. Doyen vivant de la famille.",
    "tags": [
      "ingénieur"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p11",
    "firstName": "Yvonne",
    "lastName": "Mercier",
    "gender": "female",
    "isAlive": true,
    "maidenName": "Dupont",
    "birthDate": "1941-11-05",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Professeure",
    "bio": "Yvonne a enseigné les lettres classiques au lycée pendant trente-cinq ans. Mariée à Jean Mercier, le couple n'a pas eu d'enfant et a beaucoup voyagé.",
    "tags": [
      "enseignante"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p12",
    "firstName": "Pierre",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": false,
    "birthDate": "1945-09-30",
    "deathDate": "2012-03-21",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Médecin",
    "bio": "Pierre fut médecin généraliste à Toulouse pendant plus de trente ans. Apprécié de ses patients, il a formé de nombreux internes.",
    "tags": [
      "médecin"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p13",
    "firstName": "Suzanne",
    "lastName": "Caron",
    "gender": "female",
    "isAlive": true,
    "birthDate": "1940-10-12",
    "birthPlace": {
      "city": "Grenoble",
      "country": "France"
    },
    "occupation": "Architecte",
    "bio": "Fille unique de Germaine et Fernand, Suzanne est devenue architecte, spécialisée dans la restauration du patrimoine alpin.",
    "tags": [
      "architecte"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p14",
    "firstName": "Monique",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": false,
    "maidenName": "Lambert",
    "birthDate": "1942-01-26",
    "deathDate": "1995-05-18",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Comptable",
    "bio": "Première épouse de Robert, Monique était comptable dans une coopérative agricole. Elle est décédée prématurément d'une longue maladie.",
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p15",
    "firstName": "Colette",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "maidenName": "Vidal",
    "birthDate": "1948-03-08",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Artiste-peintre",
    "bio": "Seconde épouse de Robert, Colette est artiste-peintre. Ses aquarelles des Pyrénées ont été exposées à plusieurs reprises.",
    "tags": [
      "artiste"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p16",
    "firstName": "Jean",
    "lastName": "Mercier",
    "gender": "male",
    "isAlive": true,
    "birthDate": "1939-07-01",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Notaire",
    "bio": "Jean a exercé comme notaire à Lyon. Époux d'Yvonne, il est un passionné de généalogie — c'est lui qui a commencé à reconstituer cet arbre.",
    "tags": [
      "notaire"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p17",
    "firstName": "Danielle",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "maidenName": "Petit",
    "birthDate": "1948-04-22",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Journaliste",
    "bio": "Danielle a longtemps été journaliste pour la presse régionale. Épouse de Pierre, elle continue d'écrire des chroniques sur l'histoire locale.",
    "tags": [
      "journaliste"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p18",
    "firstName": "Alain",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthDate": "1968-06-11",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Informaticien",
    "bio": "Fils de Robert et Monique, Alain est développeur logiciel. C'est lui qui maintient aujourd'hui l'arbre familial à jour.",
    "tags": [
      "informaticien"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p19",
    "firstName": "Brigitte",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "birthDate": "1972-12-03",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p20",
    "firstName": "Nathalie",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "birthDate": "1970-03-15",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Avocate",
    "bio": "Nathalie est avocate au barreau de Nantes, spécialisée en droit de la famille. Elle organise chaque été les grandes réunions familiales.",
    "tags": [
      "avocate"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p21",
    "firstName": "Sébastien",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthDate": "1973-07-19",
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Chef cuisinier",
    "bio": "Sébastien est chef étoilé, propriétaire d'un restaurant à Lyon où il revisite la cuisine de sa grand-mère Odette.",
    "tags": [
      "chef",
      "étoilé"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p22",
    "firstName": "Vincent",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthPlace": {
      "city": "Toulouse",
      "country": "France"
    },
    "occupation": "Musicien",
    "bio": "Cadet de la fratrie, Vincent est violoncelliste dans un orchestre de chambre. Sa date de naissance exacte reste à confirmer dans les archives familiales.",
    "tags": [
      "musicien"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p23",
    "firstName": "Sandrine",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "maidenName": "Girard",
    "birthDate": "1969-09-08",
    "birthPlace": {
      "city": "Nantes",
      "country": "France"
    },
    "occupation": "Vétérinaire",
    "bio": "Épouse d'Alain, Sandrine dirige une clinique vétérinaire près de Nantes. Elle a transmis à son fils l'amour des animaux.",
    "tags": [
      "vétérinaire"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p24",
    "firstName": "Émilie",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "maidenName": "Faure",
    "birthDate": "1976-05-30",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Photographe",
    "bio": "Émilie est photographe de mariage et de portrait. Elle a rencontré Sébastien en réalisant le reportage de l'ouverture de son restaurant.",
    "tags": [
      "photographe"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p25",
    "firstName": "Hugo",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthDate": "1997-10-22",
    "birthPlace": {
      "city": "Nantes",
      "country": "France"
    },
    "occupation": "Étudiant",
    "bio": "Fils unique d'Alain et Sandrine, Hugo étudie l'ingénierie agronome. Il passe ses étés à numériser les vieilles photos de famille.",
    "tags": [
      "benjamin"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p26",
    "firstName": "Chloé",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "birthDate": "1999-04-03",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Lycéenne",
    "bio": "Aînée des enfants de Sébastien, Chloé prépare un concours d'entrée en école d'art. Elle dessine depuis qu'elle sait tenir un crayon.",
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p27",
    "firstName": "Lucas",
    "lastName": "Dupont",
    "gender": "male",
    "isAlive": true,
    "birthDate": "2001-01-08",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Collégien",
    "bio": "Lucas, passionné de football et de jeux vidéo, est le portrait craché de son père au même âge.",
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  },
  {
    "id": "p28",
    "firstName": "Manon",
    "lastName": "Dupont",
    "gender": "female",
    "isAlive": true,
    "birthDate": "2004-11-14",
    "birthPlace": {
      "city": "Lyon",
      "country": "France"
    },
    "occupation": "Écolière",
    "bio": "Benjamine de toute la famille, Manon représente la cinquième génération recensée dans l'arbre.",
    "tags": [
      "benjamine"
    ],
    "createdAt": "2024-06-01T00:00:00Z",
    "updatedAt": "2024-06-01T00:00:00Z"
  }
];

export const sampleRelationships: Relationship[] = [
  {
    "id": "r1",
    "type": "spouse",
    "person1Id": "p1",
    "person2Id": "p2",
    "isActive": false
  },
  {
    "id": "r2",
    "type": "spouse",
    "person1Id": "p3",
    "person2Id": "p4",
    "isActive": false
  },
  {
    "id": "r3",
    "type": "spouse",
    "person1Id": "p5",
    "person2Id": "p8",
    "isActive": false
  },
  {
    "id": "r4",
    "type": "spouse",
    "person1Id": "p6",
    "person2Id": "p9",
    "isActive": false
  },
  {
    "id": "r5",
    "type": "spouse",
    "person1Id": "p10",
    "person2Id": "p14",
    "isActive": false
  },
  {
    "id": "r6",
    "type": "spouse",
    "person1Id": "p10",
    "person2Id": "p15",
    "isActive": true
  },
  {
    "id": "r7",
    "type": "spouse",
    "person1Id": "p11",
    "person2Id": "p16",
    "isActive": true
  },
  {
    "id": "r8",
    "type": "spouse",
    "person1Id": "p12",
    "person2Id": "p17",
    "isActive": true
  },
  {
    "id": "r9",
    "type": "spouse",
    "person1Id": "p18",
    "person2Id": "p23",
    "isActive": true
  },
  {
    "id": "r10",
    "type": "spouse",
    "person1Id": "p21",
    "person2Id": "p24",
    "isActive": true
  },
  {
    "id": "r11",
    "type": "parent",
    "person1Id": "p1",
    "person2Id": "p5"
  },
  {
    "id": "r12",
    "type": "parent",
    "person1Id": "p2",
    "person2Id": "p5"
  },
  {
    "id": "r13",
    "type": "parent",
    "person1Id": "p1",
    "person2Id": "p6"
  },
  {
    "id": "r14",
    "type": "parent",
    "person1Id": "p2",
    "person2Id": "p6"
  },
  {
    "id": "r15",
    "type": "parent",
    "person1Id": "p1",
    "person2Id": "p7"
  },
  {
    "id": "r16",
    "type": "parent",
    "person1Id": "p2",
    "person2Id": "p7"
  },
  {
    "id": "r17",
    "type": "parent",
    "person1Id": "p3",
    "person2Id": "p8"
  },
  {
    "id": "r18",
    "type": "parent",
    "person1Id": "p4",
    "person2Id": "p8"
  },
  {
    "id": "r19",
    "type": "parent",
    "person1Id": "p5",
    "person2Id": "p10"
  },
  {
    "id": "r20",
    "type": "parent",
    "person1Id": "p8",
    "person2Id": "p10"
  },
  {
    "id": "r21",
    "type": "parent",
    "person1Id": "p5",
    "person2Id": "p11"
  },
  {
    "id": "r22",
    "type": "parent",
    "person1Id": "p8",
    "person2Id": "p11"
  },
  {
    "id": "r23",
    "type": "parent",
    "person1Id": "p5",
    "person2Id": "p12"
  },
  {
    "id": "r24",
    "type": "parent",
    "person1Id": "p8",
    "person2Id": "p12"
  },
  {
    "id": "r25",
    "type": "parent",
    "person1Id": "p6",
    "person2Id": "p13"
  },
  {
    "id": "r26",
    "type": "parent",
    "person1Id": "p9",
    "person2Id": "p13"
  },
  {
    "id": "r27",
    "type": "parent",
    "person1Id": "p10",
    "person2Id": "p18"
  },
  {
    "id": "r28",
    "type": "parent",
    "person1Id": "p14",
    "person2Id": "p18"
  },
  {
    "id": "r29",
    "type": "parent",
    "person1Id": "p10",
    "person2Id": "p19"
  },
  {
    "id": "r30",
    "type": "parent",
    "person1Id": "p15",
    "person2Id": "p19"
  },
  {
    "id": "r31",
    "type": "parent",
    "person1Id": "p12",
    "person2Id": "p20"
  },
  {
    "id": "r32",
    "type": "parent",
    "person1Id": "p17",
    "person2Id": "p20"
  },
  {
    "id": "r33",
    "type": "parent",
    "person1Id": "p12",
    "person2Id": "p21"
  },
  {
    "id": "r34",
    "type": "parent",
    "person1Id": "p17",
    "person2Id": "p21"
  },
  {
    "id": "r35",
    "type": "parent",
    "person1Id": "p12",
    "person2Id": "p22"
  },
  {
    "id": "r36",
    "type": "parent",
    "person1Id": "p17",
    "person2Id": "p22"
  },
  {
    "id": "r37",
    "type": "parent",
    "person1Id": "p18",
    "person2Id": "p25"
  },
  {
    "id": "r38",
    "type": "parent",
    "person1Id": "p23",
    "person2Id": "p25"
  },
  {
    "id": "r39",
    "type": "parent",
    "person1Id": "p21",
    "person2Id": "p26"
  },
  {
    "id": "r40",
    "type": "parent",
    "person1Id": "p24",
    "person2Id": "p26"
  },
  {
    "id": "r41",
    "type": "parent",
    "person1Id": "p21",
    "person2Id": "p27"
  },
  {
    "id": "r42",
    "type": "parent",
    "person1Id": "p24",
    "person2Id": "p27"
  },
  {
    "id": "r43",
    "type": "parent",
    "person1Id": "p21",
    "person2Id": "p28"
  },
  {
    "id": "r44",
    "type": "parent",
    "person1Id": "p24",
    "person2Id": "p28"
  }
];

const sampleJournal: JournalEntry[] = [
  {
    "id": "j1",
    "title": "Réunion de famille à Lyon",
    "date": "2023-07-15",
    "content": "Quatre générations réunies dans la maison familiale du Vieux Lyon. Robert, doyen, a raconté ses souvenirs d'enfance auprès de Marcel et Odette, et nous avons feuilleté les vieux albums photos ensemble.",
    "mentionedPersonIds": [
      "p10",
      "p5",
      "p8"
    ],
    "createdAt": "2023-07-16T00:00:00Z",
    "updatedAt": "2023-07-16T00:00:00Z"
  },
  {
    "id": "j2",
    "title": "Ouverture du restaurant de Sébastien",
    "date": "2018-09-12",
    "content": "Toute la famille s'est retrouvée pour l'inauguration du restaurant de Sébastien à Lyon. C'est là qu'il a rencontré Émilie, venue photographier l'événement.",
    "mentionedPersonIds": [
      "p21",
      "p24"
    ],
    "createdAt": "2018-09-13T00:00:00Z",
    "updatedAt": "2018-09-13T00:00:00Z"
  }
];

const sampleSettings: TreeSettings = {
  "defaultView": "tree",
  "showPhotos": true,
  "showDates": true,
  "showPlaces": true,
  "colorScheme": "default",
  "generationsToShow": 5
};

export const sampleFamilyTree: FamilyTree = {
  id: 'tree1',
  name: 'Famille Dupont',
  description:
    "L'arbre généalogique de la famille Dupont — 5 générations, de 1882 à aujourd'hui. Données fictives de démonstration.",
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-06-01T00:00:00Z',
  persons: samplePersons,
  relationships: sampleRelationships,
  journal: sampleJournal,
  rootPersonId: 'p5',
  settings: sampleSettings,
};
