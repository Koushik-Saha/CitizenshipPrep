import type { Messages } from './en';

export const fr: Messages = {
  common: {
    signIn: 'Se connecter',
    signOut: 'Se déconnecter',
    countries: 'Pays',
    allCountries: 'Tous les pays',
    pricing: 'Tarifs',
    faq: 'Questions',
    backToStudy: 'Retour à l’étude',
    tryAgain: 'Réessayer',
    loading: 'Chargement',
    language: 'Langue',
    mainNav: 'Principal',
    footerNav: 'Pied de page',
    breadcrumb: 'Fil d’Ariane',
    comingSoon: 'Bientôt disponible',
    notAffiliated:
      'Oathly est une application d’étude indépendante. Elle n’est affiliée à aucun gouvernement ni approuvée par aucun.',
  },

  exam: {
    factSeparator: ', ',
    questionCount: '{count, plural, one {# question} other {# questions}}',
    toPass: '{count} pour réussir',
    minutes: '{count, plural, one {# minute} other {# minutes}}',
    noTimeLimit: 'sans limite de temps',
    takenIn: 'Se passe en {languages}',
    officialSource: 'Source officielle',
    checkedOn: 'vérifié le {date}',
    detailsBeingChecked: 'informations en cours de vérification',
    checkedQuestions:
      '{count, plural, one {# question d’entraînement vérifiée} other {# questions d’entraînement vérifiées}}',
    questionsBeingChecked: 'Les questions d’entraînement sont en cours de vérification',
    studyFor: 'Étudier pour {country}',
    countdownNone: 'Aucune date d’examen',
    countdownPassed: 'La date de l’examen est passée',
    countdownToday: 'Examen aujourd’hui',
    countdownDays: '{count, plural, one {Examen demain} other {Examen dans # jours}}',
  },

  landing: {
    metaTitle: 'Oathly : s’entraîner au test de citoyenneté de chaque pays',
    metaDescription:
      'Entraînez-vous au test de citoyenneté avec des questions vérifiées à partir des sources officielles, des réponses expliquées simplement et une estimation de votre niveau de préparation. Indépendant : affilié à aucun gouvernement.',
    heroTitle: 'Arrivez prêt à votre test de citoyenneté.',
    heroBody:
      'Des questions d’entraînement rédigées à partir du guide officiel de chaque pays, des réponses expliquées simplement et une estimation honnête de votre niveau de préparation.',
    startFree: 'Commencer gratuitement',
    seeCountries: '{count, plural, one {Voir les pays} other {Voir les # pays}}',
    searchLabel: 'Vous passez le test de citoyenneté de quel pays ?',
    searchNoMatch:
      'Aucun résultat pour « {query} » pour l’instant. Nous ajoutons un pays une fois son examen vérifié à partir des sources officielles.',
    searchStatusNone: 'Aucun pays ne correspond.',
    searchStatus:
      '{count, plural, one {# pays correspond. Appuyez sur Tab pour y accéder.} other {# pays correspondent. Appuyez sur Tab pour y accéder.}}',

    howTitle: 'Comment ça marche',
    step1Title: 'Choisissez votre pays et votre examen',
    step1Body:
      'Dites-nous quel test vous passez, quand, et dans quelle langue vous souhaitez étudier.',
    step2Title: 'Entraînez-vous un peu chaque jour',
    step2Body:
      'Chaque séance mêle les sujets qui vous posent le plus de difficultés, les questions à réviser et de nouvelles questions. Les mauvaises réponses sont accompagnées d’une explication et du passage du guide officiel.',
    step3Title: 'Passez des examens blancs à l’approche du test',
    step3Body:
      'Les examens blancs reprennent le format et la note de passage réels. Votre score de préparation montre où vous en êtes et quoi étudier ensuite.',

    countriesTitle: 'Pays et examens',
    countriesIntro:
      'Nous ajoutons un pays une fois le format de son examen et son matériel d’étude vérifiés à partir des sources officielles. D’autres arrivent.',
    countriesEmpty: 'La liste des pays est en cours de mise à jour. Revenez dans un instant.',

    featuresTitle: 'Conçu pour le test que vous passez vraiment',
    featuresIntro:
      'La plupart des applications de citoyenneté couvrent un seul pays avec une liste fixe de questions. Oathly s’appuie sur les sources officielles et sur la façon dont on apprend vraiment.',
    feature1Title: 'Le test de chaque pays, une seule application',
    feature1Body:
      'Vous préparez le test de plusieurs pays ? Étudiez pour chacun avec le même compte, avec une progression séparée.',
    feature2Title: 'Vérifié à partir de la source officielle',
    feature2Body:
      'Chaque question renvoie à la page du guide officiel dont elle est tirée et indique la date de sa dernière vérification. Une personne valide chacune avant que vous ne la voyiez.',
    feature3Title: 'Des réponses expliquées',
    feature3Body:
      'Demandez pourquoi une réponse est juste et obtenez une courte explication tirée du guide officiel, ou posez d’autres questions au tuteur.',
    feature4Title: 'Un entraînement qui s’adapte à vous',
    feature4Body:
      'Les séances se concentrent sur vos sujets les plus faibles et font revenir les questions juste avant que vous ne les oubliiez.',
    feature5Title: 'Un score de préparation fiable',
    feature5Body:
      'Une estimation pondérée comme le vrai examen, qui baisse si vous arrêtez d’étudier. Elle vous dit quoi travailler, pas seulement un chiffre.',
    feature6Title: 'Étudiez dans votre langue',
    feature6Body:
      'Choisissez parmi {count} langues. Les questions s’affichent dans la langue de l’examen tant qu’une traduction vérifiée n’est pas prête.',
    feature7Title: 'Groupes d’étude',
    feature7Body: 'Préparez-vous aux côtés de personnes qui passent le même test.',
    feature8Title: 'Pour les écoles et les organisations',
    feature8Body:
      'Les classes et les services d’accueil pourront suivre la progression de leurs apprenants.',

    pricingTitle: 'Tarifs',
    pricingIntro:
      'Commencez gratuitement avec un échantillon des questions de chaque pays. Pro ouvre tout ; un Pass Pays ouvre un pays pour de bon.',
    planFree: 'Gratuit',
    planFreeNote: 'Sans carte bancaire.',
    planAiAllowance: '{explanations} explications et {messages} messages au tuteur par jour',
    planGroups:
      'Écoles, bibliothèques et services d’accueil : des formules pour les groupes arrivent bientôt.',

    storiesTitle: 'Ce que disent les apprenants',
    storiesBody:
      'Oathly est nouveau : il n’y a pas encore d’avis. Lorsque des personnes ayant étudié ici auront passé leur test, leurs mots apparaîtront ici. Uniquement de vrais avis, avec leur accord.',

    faqTitle: 'Questions',
    faq1Question: 'Oathly est-elle une application officielle du gouvernement ?',
    faq1Answer:
      'Non. Oathly est indépendante et n’est affiliée à aucun gouvernement ni approuvée par aucun. Pour réserver votre test ou vérifier les règles qui s’appliquent à vous, utilisez le site officiel de votre gouvernement.',
    faq2Question: 'Est-ce que ce sont les vraies questions de l’examen ?',
    faq2Answer:
      'Certains pays publient les questions exactes qu’ils posent ; d’autres publient un guide d’étude et gardent les questions confidentielles. Dans les deux cas, chaque question d’Oathly est rédigée à partir du matériel officiel, renvoie à la page dont elle est tirée et est vérifiée par une personne avant que vous ne la voyiez.',
    faq3Question: 'Le score de préparation est-il fiable ?',
    faq3Answer:
      'C’est une estimation, pas une prédiction de votre résultat. Elle repose sur votre maîtrise de chaque sujet, pondérée comme votre examen, et sur vos examens blancs récents. Elle baisse si vous arrêtez d’étudier, parce qu’on oublie.',
    faq4Question: 'Puis-je étudier dans ma propre langue ?',
    faq4Answer:
      'Oui. Vous pouvez choisir parmi {count} langues. Les traductions sont vérifiées avant d’apparaître ; en attendant, vous voyez la question dans la langue de l’examen. L’examen lui-même se passe dans la langue fixée par votre pays.',
    faq5Question: 'Combien ça coûte ?',
    faq5Answer:
      'Un échantillon des questions de chaque pays est gratuit, avec l’entraînement, les cartes mémoire, le score de préparation et le mode audio. Pro, mensuel ou annuel, ouvre toutes les questions de tous les pays et ajoute davantage d’aide de l’IA. Un Pass Pays est un paiement unique qui ouvre un pays pour de bon.',
    faq6Question: 'Mon pays n’est pas dans la liste. Allez-vous l’ajouter ?',
    faq6Answer:
      'Nous visons tous les pays qui ont un test de citoyenneté. Nous ajoutons chacun une fois le format de son examen et son matériel d’étude vérifiés à partir des sources officielles.',
  },

  countries: {
    indexMetaTitle: 'Tests de citoyenneté par pays | Oathly',
    indexMetaDescription:
      'Les tests de citoyenneté auxquels Oathly vous aide à vous préparer : format, note de passage, langues et sujets, chacun vérifié à partir de la source officielle.',
    countryTitle: 'Test de citoyenneté : {country}',
    countryMetaTitle: 'Test de citoyenneté ({country}) : format, sujets et entraînement | Oathly',
    countryMetaDescription:
      'En quoi consiste le test de citoyenneté ({country}), ce qu’il couvre, et des questions d’entraînement vérifiées à partir du guide officiel.',
    countryLeadWithQuestions:
      '{count, plural, one {# question d’entraînement, vérifiée à partir du guide officiel.} other {# questions d’entraînement, chacune vérifiée à partir du guide officiel.}}',
    countryLeadNoQuestions:
      'Les questions d’entraînement sont en cours de vérification à partir du guide officiel.',
    studyForTest: 'Étudier pour le test ({country})',
    theTest: 'Le test',
    formatBeingChecked: 'Le format de l’examen est en cours de vérification.',
    whatItCovers: 'Ce qu’il couvre',
    topicBeingChecked: 'En cours de vérification',
    topicsBeingAdded: 'Les sujets sont en cours d’ajout.',
    bookingNote:
      'Pour réserver le test ou vérifier les règles qui s’appliquent à vous, utilisez le site officiel indiqué ci-dessus. Oathly est une application d’étude indépendante, affiliée à aucun gouvernement.',
    topicMetaTitle: '{topic} : entraînement au test de citoyenneté ({country}) | Oathly',
    topicMetaDescription:
      'Questions d’entraînement sur {topic} pour le test de citoyenneté ({country}), chacune vérifiée à partir du guide officiel.',
    topicLead: 'Questions d’entraînement pour le test de citoyenneté ({country}).',
    topicEmpty:
      'Les questions de ce sujet sont en cours de vérification à partir du guide officiel. Elles apparaîtront ici une fois validées par un relecteur.',
    showAnswer: 'Afficher la réponse',
    answerLabel: 'Réponse :',
    fromGuide: 'D’après le guide officiel : « {quote} »',
    source: 'Source',
    moreInApp:
      '{count, plural, one {# autre question sur {topic}, avec explications et révision espacée, vous attend dans Oathly.} other {# autres questions sur {topic}, avec explications et révision espacée, vous attendent dans Oathly.}}',
    practiseInApp:
      'Entraînez-vous avec des explications, la révision espacée et des examens blancs dans Oathly.',
    otherTopics: 'Autres sujets',
  },

  auth: {
    metaTitle: 'Se connecter | Oathly',
    title: 'Connectez-vous à Oathly',
    intro:
      'Nouveau ici ? La connexion crée votre compte. Votre progression y est enregistrée : vous pouvez continuer depuis votre téléphone ou un autre ordinateur.',
    notConfigured: 'La connexion n’est pas encore configurée sur ce serveur.',
    email: 'E-mail',
    sendLink: 'M’envoyer un lien de connexion',
    or: 'ou',
    google: 'Continuer avec Google',
    sentTitle: 'Consultez vos e-mails',
    sentBody:
      'Nous avons envoyé un lien de connexion à {email}. Il ne fonctionne qu’une fois et expire bientôt. Vous pouvez fermer cet onglet.',
    differentEmail: 'Utiliser une autre adresse',
    sendFailed: 'Nous n’avons pas pu envoyer le lien. Réessayez.',
    googleFailed: 'La connexion avec Google a échoué. Réessayez.',
    introMobile:
      'Nouveau ici ? La connexion crée votre compte. Utilisez la même adresse que sur le web et votre progression vous suit.',
    emailRequired: 'Saisissez votre adresse e-mail.',
    sendCode: 'M’envoyer un code',
    codeSent: 'Nous avons envoyé un code à six chiffres à {email}. Il expire bientôt.',
    code: 'Code',
    verifyCode: 'Se connecter',
    codeFailed: 'Ce code n’a pas fonctionné. Vérifiez-le et réessayez.',
  },

  onboarding: {
    metaTitle: 'Configurez votre étude | Oathly',
    title: 'Configurez votre étude',
    titleAdd: 'Ajouter un autre examen',
    intro: 'Quatre questions, puis vous pouvez commencer. Tout reste modifiable ensuite.',
    introAdd:
      'Vous pouvez préparer plusieurs tests de citoyenneté à la fois. La progression est conservée séparément pour chacun.',
    allCovered: 'Vous étudiez déjà pour tous les examens couverts par Oathly.',
    whichExam: 'Quel examen préparez-vous ?',
    searchCountries: 'Rechercher un pays',
    countryCount: '{count, plural, one {# pays} other {# pays}}',
    countryCountFiltered: '{shown} pays sur {total}',
    inLanguages: 'en {languages}',
    noCountryMatch:
      'Aucun pays ne correspond à « {query} ». Oathly ajoute des pays à mesure qu’il vérifie leurs examens.',
    countriesFailed:
      'Nous n’avons pas pu charger la liste des pays. Vérifiez votre connexion et réessayez.',
    examDate: 'Quand a lieu votre examen ?',
    optional: '(facultatif)',
    examDateHint: 'Elle nous sert à rythmer votre plan d’étude.',
    examDateHintMobile:
      'Année-mois-jour, par exemple 2027-03-15. Elle nous sert à rythmer votre plan d’étude.',
    studyLanguage: 'Dans quelle langue voulez-vous étudier ?',
    studyLanguageHint:
      'Les questions s’affichent dans cette langue lorsqu’une traduction vérifiée existe, sinon dans la langue de l’examen.',
    dailyGoal: 'Combien de temps pouvez-vous étudier chaque jour ?',
    minutesShort: '{count} min',
    makePrimary: 'Ouvrir l’application sur cet examen',
    start: 'Commencer à étudier',
    add: 'Ajouter cet examen',
    checkAnswers: 'Vérifiez vos réponses.',
  },

  dashboard: {
    metaTitle: 'Étudier | Oathly',
    greeting: 'Bonjour, {name}',
    title: 'Votre étude',
    todaysGoal: 'Objectif du jour',
    goalProgress: 'sur {goal} minutes',
    goalProgressToday: 'sur {goal} minutes aujourd’hui',
    streak: 'Série d’étude',
    streakDays: '{count, plural, one {jour d’affilée} other {jours d’affilée}}',
    opensFirst: 'S’ouvre en premier',
    questionsReady:
      '{count, plural, one {# question prête à étudier.} other {# questions prêtes à étudier.}}',
    questionsBeingChecked:
      'Les questions pour {country} sont encore en cours de vérification à partir du guide officiel. Elles apparaîtront ici une fois validées par un relecteur.',
    practise: 'S’entraîner',
    mockExam: 'Examen blanc',
    askTutor: 'Interroger le tuteur sur {country}',
    stopStudying: 'Ne plus étudier pour cet examen',
    addExam: 'Ajouter un autre examen',
    loadFailed: 'Nous n’avons pas pu charger votre plan d’étude.',
    loadingPlan: 'Chargement de votre plan d’étude',
  },

  readiness: {
    title: 'Préparation estimée',
    earlyEstimate: 'Première estimation',
    earlyTitle: 'Première estimation de votre préparation',
    meter: '{score} %, estimé',
    meterEarly: '{score} %, estimé, première estimation',
    basedOn:
      '{count, plural, one {Fondée sur # question pour l’instant. Elle se stabilise à mesure que vous vous entraînez.} other {Fondée sur # questions pour l’instant. Elle se stabilise à mesure que vous vous entraînez.}}',
    disclaimer:
      'C’est une estimation tirée de votre entraînement et de vos examens blancs, pondérée comme le vrai examen. Elle ne garantit pas votre résultat et baisse si vous arrêtez de réviser.',
    topicKnowledge: 'Maîtrise des sujets',
    recentMocks: 'Examens blancs récents',
    noMocks: 'Aucun pour l’instant',
    mockAverage: '{percent} % de bonnes réponses',
    studyNext: 'Quoi étudier ensuite',
    nothingStandsOut: 'Rien ne ressort. Poursuivez votre entraînement quotidien.',
    suggestStart: 'Commencer à s’entraîner',
    suggestStartDetail: 'Votre première série mêle des questions de tous les sujets.',
    suggestReview:
      '{count, plural, one {Révisez # question que vous êtes sur le point d’oublier} other {Révisez # questions que vous êtes sur le point d’oublier}}',
    suggestReviewDetail: 'Y répondre maintenant, au bon moment, c’est ce qui les ancre.',
    suggestTopicDetail: 'Environ {share} % de l’examen, et vous en maîtrisez {mastery} %.',
    suggestMock: 'Passer un examen blanc',
    suggestMockDetail: '{exam}, chronométré comme le vrai.',
    start: 'Commencer',
    byTopic: 'Par sujet',
    shareOfExam: '({share} % de l’examen)',
  },

  start: {
    questionsFrom: 'Questions parmi',
    adaptive: 'Sur mesure : sujets faibles, révisions et nouveautés',
    adaptiveDue: 'Sur mesure : sujets faibles, révisions et nouveautés ({count} à revoir)',
    random: 'Tous les sujets, au hasard',
    howMany: 'Combien',
    flashcards: 'Cartes mémoire',
    startMock: 'Commencer l’examen blanc',
    practiceIntro:
      'Dix questions choisies pour vous : sujets faibles, révisions et nouvelles questions.',
    practiceIntroDue:
      'Dix questions choisies pour vous : sujets faibles, révisions ({count} à revoir) et nouvelles questions.',
    oneTopic: 'S’entraîner sur un sujet',
    hideTopics: 'Masquer les sujets',
    topicWithMastery: '{topic} ({mastery} %)',
  },

  session: {
    metaTitle: 'Séance d’étude | Oathly',
    practice: 'Entraînement',
    flashcards: 'Cartes mémoire',
    mockExam: 'Examen blanc',
    finishedTitle: 'Cette séance est terminée',
    finishedBody: 'Commencez-en une nouvelle depuis votre page d’étude.',
    timeLeftMinutes:
      '{count, plural, one {Temps restant : # minute} other {Temps restant : # minutes}}',
    timeLeft: 'Il reste {time}',
    questionOf: 'Question {current} sur {total}',
    progress: 'Progression',
    chooseOne: 'Choisissez une réponse',
    chooseAll: 'Choisissez toutes les bonnes réponses',
    correct: 'Correct',
    notQuite: 'Pas tout à fait',
    check: 'Vérifier',
    next: 'Suivant',
    submitExam: 'Remettre l’examen',
    nextQuestion: 'Question suivante',
    seeResults: 'Voir les résultats',
    keysChoose: 'Touches : 1–{count} pour choisir, Entrée pour valider',
    keysContinue: 'Touches : Entrée pour continuer',
    answer: 'Réponse',
    answerInHead: 'Répondez dans votre tête, puis retournez la carte.',
    didNotKnow: 'Je ne savais pas',
    knewIt: 'Je le savais',
    showAnswer: 'Afficher la réponse',
    keysRate: 'Touches : 1 ou 2',
    keysTurn: 'Touche : Entrée ou Espace pour retourner',
    stillLearning: 'En cours d’apprentissage',
    swipeHint:
      'Faites glisser la carte vers la droite si vous le saviez, vers la gauche si vous l’apprenez encore.',
    tapToShow: 'Touchez pour afficher la réponse',
    leave: 'Quitter',
    yourAnswer: 'Votre réponse',
    correctAnswer: 'Bonne réponse',
    fromGuide: 'D’après le guide officiel : « {quote} »',
    openFailedTitle: 'Nous n’avons pas pu ouvrir cette séance',
    openFailedBody:
      'Elle a peut-être été commencée sur un autre appareil pendant que ce téléphone était hors ligne.',
    loadingSession: 'Chargement de votre séance',
    showInExamLanguage: 'Afficher dans la langue de l’examen ({language})',
    showInStudyLanguage: 'Afficher dans ma langue d’étude ({language})',
    languageNote: 'Le vrai examen se passe en {language}.',
  },

  results: {
    passed: 'Vous avez réussi',
    notPassed: 'Pas réussi cette fois',
    complete: 'Séance terminée',
    stoppedPassed: 'Vous avez atteint la note de passage : l’examinateur s’arrêterait ici.',
    stoppedFailed: 'Il n’est plus possible de réussir : l’examinateur s’arrêterait ici.',
    timeUp: 'Le temps est écoulé.',
    timedOut: 'Le temps s’est écoulé avant les dernières réponses.',
    correctOf: 'sur {total} correctes.',
    knownOf: 'sur {total} sues.',
    neededToPass: '{count} nécessaires pour réussir.',
    sectionAllCorrect:
      'Toutes les questions de « {section} » doivent être justes ; {correct} sur {total} l’étaient.',
    byTopic: 'Par sujet',
    topic: 'Sujet',
    correctColumn: 'Correctes',
    scoreOf: '{correct} sur {total}',
    nothingToReview: 'Rien à revoir',
    reviewCards: 'Cartes à revoir',
    reviewWrong: 'Revoyez vos mauvaises réponses',
    youAnswered: 'Votre réponse : {answer}',
    nothing: 'rien',
    correctAnswer: 'Bonne réponse : {answer}',
    source: 'source',
  },

  explain: {
    more: 'Expliquer davantage',
    writing: 'Rédaction d’une explication…',
    aiNote:
      'Rédigé par IA à partir du passage du guide officiel. Non vérifié par un relecteur, peut contenir des erreurs.',
  },

  tutor: {
    metaTitle: 'Interroger le tuteur | Oathly',
    title: 'Interroger le tuteur',
    intro:
      'Des questions sur le test de citoyenneté ({country}) et son matériel d’étude. Le tuteur répond uniquement à partir du guide officiel et c’est une IA : vérifiez tout point important dans le guide. Il ne peut pas vous conseiller sur votre propre demande.',
    you: 'Vous :',
    tutor: 'Tuteur :',
    questionLabel: 'Votre question sur le test ({country})',
    ask: 'Demander',
    keys: 'Entrée pour envoyer, Maj+Entrée pour un retour à la ligne.',
    remaining:
      '{count, plural, one {Il vous reste # question aujourd’hui.} other {Il vous reste # questions aujourd’hui.}}',
    opening: 'Ouverture du tuteur',
  },

  audio: {
    mode: 'Mode audio',
    hint: 'Chaque question est lue à voix haute. Répondez en touchant l’écran ou à voix haute.',
    replay: 'Relire',
    voiceAnswers: 'Répondre à la voix',
    speak: 'Répondre à voix haute',
    stopListening: 'Arrêter l’écoute',
    listening: 'Écoute en cours…',
    speaking: 'Lecture à voix haute…',
    sayNumber: 'Dites le numéro de votre réponse, ou la réponse elle-même.',
    heard: 'J’ai entendu : « {words} »',
    notCaught: 'Cela ne correspond à aucune des réponses.',
    useAnswer: 'Utiliser cette réponse',
    sayAgain: 'Répéter',
    showChoices: 'Choisir parmi les réponses',
    showQuestion: 'Afficher la question par écrit',
    hideQuestion: 'Masquer la question écrite',
    listenToQuestion: 'Écoutez la question',
    micBlocked:
      'Oathly ne peut pas utiliser le micro. Autorisez-le dans vos réglages, ou répondez en touchant l’écran.',
    voiceUnavailable:
      'Cet appareil ne prend pas en charge les réponses orales. Répondez en touchant l’écran.',
    correct: 'Correct.',
    notQuite: 'Pas tout à fait. La réponse est :',
    interview: 'Entretien blanc',
    startInterview: 'Commencer l’entretien blanc',
    interviewIntro:
      'Les questions sont posées à voix haute, comme à l’examen réel. Répondez à voix haute, dans la langue de l’examen.',
  },

  plans: {
    title: 'Offres',
    metaTitle: 'Offres | Oathly',
    yourPlan: 'Votre offre',
    free: 'Gratuit',
    pro: 'Pro',
    countryPass: 'Pass Pays',
    freeSummary:
      'Un échantillon de {count} questions par pays, avec l’entraînement, les cartes mémoire, le score de préparation et le mode audio.',
    proSummary:
      'Toutes les questions de tous les pays, des examens et entretiens blancs complets, et davantage d’aide de l’IA.',
    passSummary:
      'Toutes les questions d’un pays, avec ses examens blancs complets. Un seul paiement, à vous pour toujours.',
    proNote: 'Mensuel ou annuel. Résiliable à tout moment.',
    passNote: 'Un seul paiement. Sans abonnement.',
    perMonth: '{price} par mois',
    perYear: '{price} par an',
    once: '{price}, une seule fois',
    getMonthly: 'Passer à Pro, mensuel',
    getYearly: 'Passer à Pro, annuel',
    getPass: 'Obtenir le pass pour {country}',
    onPro: 'Vous avez Pro.',
    renewsOn: 'Renouvellement le {date}.',
    endsOn: 'Il prend fin le {date} et ne sera pas renouvelé.',
    passFor: 'Pass Pays : {country}',
    manage: 'Gérer la facturation',
    manageInStore: 'Cet abonnement a été acheté sur {store}. Modifiez-le ou résiliez-le là-bas.',
    boughtOnWeb:
      'Cet abonnement a été acheté sur le site web d’Oathly. Modifiez-le ou résiliez-le là-bas.',
    unavailable: 'Les offres ne peuvent pas encore être achetées ici.',
    thanks: 'Merci. Votre offre apparaîtra ici dans un instant.',
    freeLimit: 'L’offre Gratuit comprend {available} questions sur {total}.',
    seePlans: 'Voir les offres',
    examLocked: 'Cet examen demande plus de questions que n’en comprend l’offre Gratuit.',
    terms:
      'Pro se renouvelle jusqu’à résiliation. Si vous résiliez, vous gardez Pro jusqu’à la fin de la période payée.',
    restore: 'Restaurer les achats',
    purchaseFailed: 'L’achat n’a pas abouti.',
    notInThisBuild: 'Les achats ne sont pas disponibles dans cette version de l’application.',
  },

  org: {
    metaTitle: 'Organisations | Oathly',
    title: 'Organisations',
    forOrganizations: 'Pour les organisations',
    intro:
      'Pour les cabinets d’avocats, les écoles et les associations qui aident des personnes à se préparer. Invitez vos apprenants, donnez à chacun un pays et une date, et voyez qui est prêt et qui a besoin d’aide.',
    yours: 'Vos organisations',
    roleOwner: 'Propriétaire',
    roleAdmin: 'Administrateur',
    roleMember: 'Apprenant',
    open: 'Ouvrir',
    studyingWith: 'Vous étudiez avec {organization}',
    adminsSee:
      'Ses administrateurs peuvent voir votre score de préparation et le temps que vous consacrez à l’examen qu’ils vous ont attribué. Ils ne voient pas vos réponses individuelles.',
    leave: 'Quitter {organization}',
    create: 'Créer une organisation',
    name: 'Nom de l’organisation',
    kind: 'Type d’organisation',
    kindLawFirm: 'Cabinet d’avocats',
    kindSchool: 'École',
    kindNonprofit: 'Association',
    kindOther: 'Autre',
    createButton: 'Créer',
    learners: 'Apprenants',
    invite: 'Inviter',
    settings: 'Paramètres',
    allOrganizations: 'Toutes les organisations',
    seats: 'Places',
    seatsUsed: '{used} sur {total} utilisées',
    seatsPending:
      '{count, plural, one {# réservée par une invitation} other {# réservées par des invitations}}',
    seatsAvailable: '{count, plural, one {# libre} other {# libres}}',
    seatsOver:
      '{count, plural, one {# apprenant n’a pas de place et utilise l’offre gratuite.} other {# apprenants n’ont pas de place et utilisent l’offre gratuite.}}',
    seatsNone:
      'Cette organisation n’a pas encore de places. Il faut une place pour inviter un apprenant.',
    seatsExplain:
      'Chaque apprenant occupe une place et étudie avec Pro : toutes les questions, de tous les pays.',
    seatsGranted:
      '{count, plural, one {# place offerte par Oathly.} other {# places offertes par Oathly.}}',
    seatCount: 'Nombre de places',
    buySeats: 'Acheter des places',
    perSeatMonth: '{price} par place et par mois',
    perSeatYear: '{price} par place et par an',
    manageBilling: 'Modifier les places ou la facturation',
    seatsRenew: 'Renouvellement le {date}.',
    seatsEnd: 'Se termine le {date} et ne sera pas renouvelé.',
    seatsEnded: 'L’abonnement est terminé.',
    billingUnavailable: 'Il n’est pas encore possible d’acheter des places ici.',
    seatsThanks: 'Merci. Vos places apparaîtront ici dans un instant.',
    summaryReady: 'Prêts',
    summaryBehind: 'À suivre de près',
    summaryActive: 'Actifs cette semaine',
    summaryAverage: 'Préparation moyenne',
    colLearner: 'Apprenant',
    colEmail: 'E-mail',
    colCountry: 'Pays',
    colTargetDate: 'Date cible',
    colDaysLeft: 'Jours restants',
    colReadiness: 'Préparation',
    colStanding: 'Situation',
    colLastActive: 'Dernière activité',
    colThisWeek: 'Cette semaine',
    colAnswersWeek: 'Réponses cette semaine',
    colMinutesWeek: 'Minutes cette semaine',
    colAnswers: 'Réponses au total',
    colMockExams: 'Examens blancs',
    colLastMock: 'Dernier examen blanc (%)',
    colJoined: 'Inscription',
    standingReady: 'Prêt',
    standingOnTrack: 'En bonne voie',
    standingBehind: 'À suivre de près',
    standingNotStarted: 'Pas commencé',
    never: 'Jamais',
    noDate: 'Pas de date',
    notAssigned: 'Non attribué',
    noScore: 'Pas encore de score',
    earlyEstimate: 'première estimation',
    thisWeek: '{answers, plural, one {# réponse} other {# réponses}}, {minutes} min',
    daysLeft: '{count, plural, one {# jour restant} other {# jours restants}}',
    datePassed: 'la date est passée',
    noSeat: 'Sans place',
    sortBy: 'Trier par',
    sortAttention: 'À suivre de près d’abord',
    sortName: 'Nom',
    sortReadiness: 'Préparation',
    sortDate: 'Date cible',
    sortActivity: 'Dernière activité',
    noLearners:
      'Pas encore d’apprenants. Invitez les personnes que vous aidez ; elles apparaîtront ici une fois inscrites.',
    change: 'Modifier',
    save: 'Enregistrer',
    remove: 'Retirer de l’organisation',
    exportCsv: 'Télécharger le CSV',
    exportPdf: 'Imprimer ou enregistrer en PDF',
    readinessNote:
      'La préparation est l’estimation que chaque apprenant voit sur son propre tableau de bord, pour le pays que vous avez attribué. Vous ne voyez pas ses réponses individuelles.',
    inviteTitle: 'Inviter des personnes',
    inviteHelp:
      'Saisissez ou collez des adresses e-mail, une par ligne, ou importez un fichier CSV avec les colonnes email, name, country et target date. Seule l’adresse e-mail est nécessaire.',
    inviteEmails: 'Adresses e-mail',
    inviteFile: 'Ou un fichier CSV',
    inviteCountry: 'Pays, pour les lignes qui n’en indiquent pas',
    inviteDate: 'Date cible, pour les lignes qui n’en indiquent pas',
    inviteNoCountry: 'Aucun pays',
    inviteRole: 'Inviter comme',
    inviteAsLearners: 'Apprenants',
    inviteAsAdmins: 'Administrateurs, qui voient tous les apprenants',
    inviteButton: 'Inviter',
    inviteSent:
      '{count, plural, one {# invitation envoyée par e-mail.} other {# invitations envoyées par e-mail.}}',
    inviteNotSent:
      '{count, plural, one {# invitation est prête, mais aucun e-mail n’a été envoyé. Transmettez le lien vous-même.} other {# invitations sont prêtes, mais aucun e-mail n’a été envoyé. Transmettez chaque lien vous-même.}}',
    inviteLinks: 'Liens d’invitation',
    inviteLinkNote:
      'Chaque lien fonctionne une seule fois, pour une seule personne, et n’est affiché que maintenant.',
    inviteAlreadyMembers: 'Déjà membres : {emails}',
    inviteNoSeats: 'Plus de place pour : {emails}',
    inviteProblems: 'Lignes inutilisables',
    inviteLine: 'Ligne {line} : {value}',
    problemBadEmail: 'ce n’est pas une adresse e-mail',
    problemDuplicate: 'indiquée deux fois',
    problemUnknownCountry: 'ce n’est pas un pays couvert par Oathly',
    problemBadDate: 'écrivez les dates au format AAAA-MM-JJ',
    problemPastDate: 'la date est passée',
    inviteOverLimit:
      '{count} de plus ont été laissées de côté : une liste peut inviter {limit} personnes.',
    inviteNothing: 'Il n’y avait personne à inviter dans la liste.',
    pending: 'Invitations en attente',
    invitedOn: 'Invité le {date}',
    expiresOn: 'expire le {date}',
    expired: 'Expirée',
    resend: 'Renvoyer',
    revoke: 'Retirer',
    noPending: 'Aucune invitation en attente.',
    details: 'Informations',
    saved: 'Enregistré.',
    branding: 'Votre image sur les tableaux de bord des apprenants',
    brandingHelp:
      'Facultatif. Votre logo et vos couleurs apparaissent sur les tableaux de bord des apprenants que vous invitez. Les teintes sont ajustées si nécessaire pour que le texte reste lisible.',
    brandColor: 'Couleur principale',
    brandAccent: 'Couleur d’accent',
    colorHint:
      'Une couleur hexadécimale, par exemple #0b5fff. Laissez vide pour utiliser celles d’Oathly.',
    logo: 'Logo',
    logoHint: 'PNG, JPEG ou WebP, 256 Ko maximum.',
    logoUpload: 'Importer un logo',
    logoRemove: 'Supprimer le logo',
    logoAlt: 'Logo de {organization}',
    preview: 'Aperçu',
    previewButton: 'Commencer à s’entraîner',
    previewLink: 'Voir vos progrès',
    team: 'Personnes qui gèrent cette organisation',
    errorInvalid: 'Vérifiez les informations et réessayez.',
    errorForbidden: 'Votre rôle dans cette organisation ne le permet pas.',
    errorNotFound: 'Cette organisation est introuvable.',
    errorInviteGone:
      'Cette invitation a expiré ou a été retirée. Demandez-en une nouvelle à la personne qui vous a invité.',
    errorWrongAddress:
      'Cette invitation a été envoyée à une autre adresse e-mail. Ouvrez plutôt le lien reçu par e-mail.',
    errorBadLogo: 'Le logo doit être une image PNG, JPEG ou WebP de 256 Ko maximum.',
    joinTitle: 'Rejoindre {organization}',
    joinInvited: '{organization} vous invite à étudier avec eux sur Oathly.',
    joinInvitedAdmin:
      '{organization} vous invite à participer à la gestion de leur organisation sur Oathly.',
    joinAssigned:
      'Ils souhaitent que vous vous prépariez à l’examen de citoyenneté de ce pays : {country}.',
    joinTarget: 'Date cible : {date}.',
    joinIncludes: 'Votre place comprend Oathly Pro, sans frais pour vous.',
    joinConsent:
      'Si vous rejoignez {organization}, ses administrateurs verront votre score de préparation et le temps que vous consacrez à cet examen. Ils ne verront pas vos réponses individuelles, et vous pouvez partir à tout moment.',
    joinButton: 'Rejoindre',
    joinSignIn: 'Se connecter pour rejoindre',
    joined: 'Vous avez rejoint {organization}.',
    invitedBanner: '{organization} vous invite à étudier avec eux.',
    viewInvitation: 'Rejoindre',
    planFromOrg: 'Pro, fourni par {organization}.',
    reportTitle: 'Rapport de préparation des apprenants',
    reportGenerated: 'Généré le {date}',
    reportBack: 'Retour aux apprenants',
    emailSubject: '{organization} vous invite sur Oathly',
    emailHello: 'Bonjour,',
    emailHelloName: 'Bonjour {name},',
    emailBody:
      '{organization} vous invite à préparer votre examen de citoyenneté avec Oathly. Votre place est payée.',
    emailBodyAdmin:
      '{organization} vous invite à participer à la gestion de leur organisation sur Oathly.',
    emailAction: 'Accepter l’invitation',
    emailExpires: 'Le lien fonctionne une seule fois et expire dans {days} jours.',
    emailFooter:
      'Oathly est une application d’étude indépendante. Elle n’est affiliée à aucun gouvernement et n’est approuvée par aucun. Si vous n’attendiez pas ce message, vous pouvez l’ignorer.',
  },

  offline: {
    title: 'Étudier hors ligne',
    saved:
      '{count, plural, one {# question enregistrée sur ce téléphone, au {date}. Vous pouvez vous entraîner et passer des examens blancs sans connexion.} other {# questions enregistrées sur ce téléphone, au {date}. Vous pouvez vous entraîner et passer des examens blancs sans connexion.}}',
    notSaved:
      'Enregistrez ce pays sur votre téléphone pour vous entraîner et passer des examens blancs sans connexion. Vos réponses sont envoyées quand vous êtes de nouveau en ligne.',
    save: 'Enregistrer pour le hors-ligne',
    update: 'Mettre à jour les questions enregistrées',
    bannerOfflineWaiting:
      '{count, plural, one {Vous êtes hors ligne. # élément enregistré sera envoyé à votre retour en ligne.} other {Vous êtes hors ligne. # éléments enregistrés seront envoyés à votre retour en ligne.}}',
    bannerOffline: 'Vous êtes hors ligne. Les pays enregistrés fonctionnent toujours.',
    bannerSending:
      '{count, plural, one {Envoi de # élément enregistré…} other {Envoi de # éléments enregistrés…}}',
    bannerWaiting:
      '{count, plural, one {# élément enregistré en attente d’envoi.} other {# éléments enregistrés en attente d’envoi.}}',
    savingAudio: 'Enregistrement de l’audio : {done} sur {total}',
    audioSaved:
      '{count, plural, one {# enregistrement sauvegardé pour le mode audio.} other {# enregistrements sauvegardés pour le mode audio.}}',
    progressLater: 'Votre progression s’affichera ici quand vous serez de nouveau en ligne.',
    noConnection:
      'Pas de connexion. Téléchargez ce pays quand vous êtes en ligne pour étudier sans connexion.',
  },

  profile: {
    title: 'Votre profil',
    tabStudy: 'Étudier',
    tabProfile: 'Profil',
    progress: 'Progression',
    sessions: 'Séances',
    answered: 'Répondues',
    correct: 'Correctes',
    dailyGoal: 'Objectif quotidien : {count} minutes.',
    yourExams: 'Vos examens',
    studyingIn: 'Vous étudiez en {language}.',
    offline: 'Hors ligne',
    noPacks:
      'Aucun pays enregistré sur ce téléphone pour l’instant. Enregistrez-en un depuis l’onglet Étudier pour vous entraîner sans connexion.',
    packLine:
      '{count, plural, one {{country} : # question, enregistrée le {date}.} other {{country} : # questions, enregistrées le {date}.}}',
    removePack: 'Supprimer de ce téléphone',
    allSaved: 'Toutes vos réponses sont enregistrées dans votre compte.',
    waiting:
      '{count, plural, one {# élément enregistré est en attente d’envoi.} other {# éléments enregistrés sont en attente d’envoi.}}',
    lastTry: 'Dernière tentative : {problem}',
    sendNow: 'Envoyer maintenant',
    appLanguage: 'Langue de l’application',
    appLanguageHint:
      'La langue des boutons et des menus. La langue dans laquelle vous étudiez les questions se règle pour chaque examen.',
  },

  welcome: {
    countriesSoFar: '{count} pays pour l’instant.',
    getStarted: 'Commencer',
    unreachable: 'Impossible de joindre Oathly. Vérifiez votre connexion et réessayez.',
  },
};
