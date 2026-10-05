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
      'Étudier est gratuit. Une formule payante ajoutera davantage d’aide par IA pour ceux qui l’utilisent beaucoup.',
    planFree: 'Gratuit',
    planFreeNote: 'Sans carte bancaire.',
    planFreeItem1: 'Entraînement, cartes mémoire et examens blancs illimités',
    planFreeItem2: 'Score de préparation et suggestions d’étude',
    planAiAllowance: '{explanations} explications et {messages} messages au tuteur par jour',
    planFreeItem4: 'Tous les pays et toutes les langues d’étude',
    planPremium: 'Premium',
    planPremiumNote: 'Prix à venir.',
    planPremiumItem1: 'Tout ce qui est inclus dans Gratuit',
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
      'L’entraînement, les cartes mémoire, les examens blancs et le score de préparation sont gratuits. Une formule payante avec davantage d’explications par IA et de messages au tuteur est prévue ; son prix n’est pas encore fixé.',
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
