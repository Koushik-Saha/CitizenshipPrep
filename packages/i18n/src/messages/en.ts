// The apps' text, in English: the source every other language is translated
// from and checked against (same keys, same placeholders). Web and mobile
// share it. See ../format.ts for the placeholder and plural syntax.

export const en = {
  common: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    countries: 'Countries',
    allCountries: 'All countries',
    pricing: 'Pricing',
    faq: 'Questions',
    backToStudy: 'Back to study',
    tryAgain: 'Try again',
    loading: 'Loading',
    language: 'Language',
    mainNav: 'Main',
    footerNav: 'Footer',
    breadcrumb: 'Breadcrumb',
    comingSoon: 'Coming soon',
    notAffiliated:
      'Oathly is an independent study app. It is not affiliated with, or endorsed by, any government.',
  },

  exam: {
    // Between the facts of an exam: "20 questions, 15 to pass, 45 minutes".
    factSeparator: ', ',
    questionCount: '{count, plural, one {# question} other {# questions}}',
    toPass: '{count} to pass',
    minutes: '{count, plural, one {# minute} other {# minutes}}',
    noTimeLimit: 'no time limit',
    takenIn: 'Taken in {languages}',
    officialSource: 'Official source',
    checkedOn: 'checked {date}',
    detailsBeingChecked: 'details being checked',
    checkedQuestions:
      '{count, plural, one {# checked practice question} other {# checked practice questions}}',
    questionsBeingChecked: 'Practice questions are being checked',
    studyFor: 'Study for {country}',
    countdownNone: 'No exam date set',
    countdownPassed: 'Exam date has passed',
    countdownToday: 'Exam today',
    countdownDays: '{count, plural, one {Exam tomorrow} other {Exam in # days}}',
  },

  landing: {
    metaTitle: 'Oathly: citizenship test practice for every country',
    metaDescription:
      'Practise for your citizenship test with questions checked against official sources, answers explained in plain language, and an estimate of how ready you are. Independent: not affiliated with any government.',
    heroTitle: 'Walk into your citizenship test ready.',
    heroBody:
      'Practice questions written from each country’s official study guide, answers explained in plain language, and an honest estimate of how ready you are.',
    startFree: 'Start studying free',
    seeCountries: '{count, plural, one {See the countries} other {See all # countries}}',
    searchLabel: 'Which country’s citizenship test are you taking?',
    searchNoMatch:
      'No match for “{query}” yet. We add countries once we’ve checked their exam against official sources.',
    searchStatusNone: 'No matching country.',
    searchStatus:
      '{count, plural, one {# matching country. Press Tab to reach it.} other {# matching countries. Press Tab to reach them.}}',

    howTitle: 'How it works',
    step1Title: 'Choose your country and exam',
    step1Body:
      'Tell us which test you are taking, when, and which language you would like to study in.',
    step2Title: 'Practise a little each day',
    step2Body:
      'Each session mixes the topics you find hardest, questions due for review, and new ones. Wrong answers come with an explanation and the passage from the official guide.',
    step3Title: 'Sit mock exams when you are close',
    step3Body:
      'Mock exams follow the real format and pass mark. Your readiness score shows how close you are, and what to study next.',

    countriesTitle: 'Countries and exams',
    countriesIntro:
      'We add a country once its exam format and study material have been checked against official sources. More are on the way.',
    countriesEmpty: 'The country list is being updated. Check back shortly.',

    featuresTitle: 'Built for the test you are actually taking',
    featuresIntro:
      'Most citizenship apps cover one country with a fixed question list. Oathly is built around official sources and how people really learn.',
    feature1Title: 'Every country’s test, one app',
    feature1Body:
      'Preparing for more than one country’s test? Study for each in the same account, with progress kept separately.',
    feature2Title: 'Checked against the official source',
    feature2Body:
      'Every question links to the page of the official guide it comes from and shows when it was last checked. A person approves each one before you see it.',
    feature3Title: 'Answers explained',
    feature3Body:
      'Ask why an answer is right and get a short explanation built from the official guide, or ask the tutor follow-up questions.',
    feature4Title: 'Practice that adapts to you',
    feature4Body:
      'Sessions focus on your weakest topics and bring questions back just before you would forget them.',
    feature5Title: 'A readiness score you can trust',
    feature5Body:
      'An estimate weighted the way the real exam is, which drops if you stop studying. It tells you what to work on, not just a number.',
    feature6Title: 'Study in your own language',
    feature6Body:
      'Choose from {count} languages. Questions switch to the exam’s language where a checked translation is not ready yet.',
    feature7Title: 'Study groups',
    feature7Body: 'Prepare alongside people taking the same test.',
    feature8Title: 'For schools and organisations',
    feature8Body:
      'Classes and settlement services will be able to track how their learners are doing.',

    pricingTitle: 'Pricing',
    pricingIntro:
      'Studying is free. A paid plan will add more AI help for people who use a lot of it.',
    planFree: 'Free',
    planFreeNote: 'No card needed.',
    planFreeItem1: 'Unlimited practice, flashcards and mock exams',
    planFreeItem2: 'Readiness score and study suggestions',
    planAiAllowance: '{explanations} answer explanations and {messages} tutor messages a day',
    planFreeItem4: 'Every country and study language',
    planPremium: 'Premium',
    planPremiumNote: 'Price to be announced.',
    planPremiumItem1: 'Everything in Free',
    planGroups: 'Schools, libraries and settlement services: plans for groups are coming soon.',

    storiesTitle: 'What learners say',
    storiesBody:
      'Oathly is new, so there are no reviews yet. Once learners who studied here have taken their tests, their words will go here. Only real ones, with their permission.',

    faqTitle: 'Questions',
    faq1Question: 'Is Oathly an official government app?',
    faq1Answer:
      'No. Oathly is independent and is not affiliated with, or endorsed by, any government. To book your test or check the rules that apply to you, use your government’s official website.',
    faq2Question: 'Are these the real exam questions?',
    faq2Answer:
      'Some countries publish the exact questions they ask; others publish a study guide and keep the questions private. Either way, every Oathly question is written from the official material, links to the page it comes from, and is checked by a person before you see it.',
    faq3Question: 'How accurate is the readiness score?',
    faq3Answer:
      'It is an estimate, not a prediction of your result. It is based on how well you know each topic, weighted the way your exam is, and on your recent mock exams. It goes down if you stop studying, because you forget.',
    faq4Question: 'Can I study in my own language?',
    faq4Answer:
      'Yes. You can choose from {count} languages. Translations are checked before they appear; until then you see the question in the exam’s language. The exam itself is taken in the language your country sets.',
    faq5Question: 'What does it cost?',
    faq5Answer:
      'Practice, flashcards, mock exams and the readiness score are free. A paid plan with more AI explanations and tutor messages is coming; its price is not set yet.',
    faq6Question: 'My country is not listed. Will you add it?',
    faq6Answer:
      'We are working towards every country that has a citizenship test. We add each one once its exam format and study material have been checked against official sources.',
  },

  countries: {
    indexMetaTitle: 'Citizenship tests by country | Oathly',
    indexMetaDescription:
      'The citizenship tests Oathly helps you prepare for: format, pass mark, languages and topics, each checked against the official source.',
    countryTitle: '{country} citizenship test',
    countryMetaTitle: '{country} citizenship test: format, topics and practice | Oathly',
    countryMetaDescription:
      'What the {country} citizenship test involves, what it covers, and practice questions checked against the official guide.',
    countryLeadWithQuestions:
      '{count, plural, one {# practice question, checked against the official guide.} other {# practice questions, each checked against the official guide.}}',
    countryLeadNoQuestions: 'Practice questions are being checked against the official guide.',
    studyForTest: 'Study for the {country} test',
    theTest: 'The test',
    formatBeingChecked: 'The exam format is being checked.',
    whatItCovers: 'What it covers',
    topicBeingChecked: 'Being checked',
    topicsBeingAdded: 'Topics are being added.',
    bookingNote:
      'To book the test or check the rules that apply to you, use the official website linked above. Oathly is an independent study app and is not affiliated with any government.',
    topicMetaTitle: '{topic}: {country} citizenship test practice | Oathly',
    topicMetaDescription:
      'Practice questions on {topic} for the {country} citizenship test, each checked against the official guide.',
    topicLead: 'Practice questions for the {country} citizenship test.',
    topicEmpty:
      'The questions for this topic are being checked against the official guide. They appear here once a reviewer has approved them.',
    showAnswer: 'Show the answer',
    answerLabel: 'Answer:',
    fromGuide: 'From the official guide: “{quote}”',
    source: 'Source',
    moreInApp:
      '{count, plural, one {# more {topic} question, with explanations and spaced review, is waiting in Oathly.} other {# more {topic} questions, with explanations and spaced review, are waiting in Oathly.}}',
    practiseInApp: 'Practise with explanations, spaced review and mock exams in Oathly.',
    otherTopics: 'Other topics',
  },

  auth: {
    metaTitle: 'Sign in | Oathly',
    title: 'Sign in to Oathly',
    intro:
      'New here? Signing in creates your account. Your progress is saved to it, so you can carry on from your phone or another computer.',
    notConfigured: 'Sign-in is not set up on this server yet.',
    email: 'Email',
    sendLink: 'Email me a sign-in link',
    or: 'or',
    google: 'Continue with Google',
    sentTitle: 'Check your email',
    sentBody:
      'We sent a sign-in link to {email}. It works once and expires soon. You can close this tab.',
    differentEmail: 'Use a different email',
    sendFailed: 'We could not send the link. Try again.',
    googleFailed: 'Google sign-in failed. Try again.',
    // Mobile signs in with an emailed code instead of a link.
    introMobile:
      'New here? Signing in creates your account. Use the same email as on the web and your progress follows you.',
    emailRequired: 'Enter your email address.',
    sendCode: 'Email me a code',
    codeSent: 'We sent a six-digit code to {email}. It expires soon.',
    code: 'Code',
    verifyCode: 'Sign in',
    codeFailed: 'That code did not work. Check it and try again.',
  },

  onboarding: {
    metaTitle: 'Set up your study | Oathly',
    title: 'Set up your study',
    titleAdd: 'Add another exam',
    intro: 'Four questions, then you can start. You can change any of this later.',
    introAdd:
      'You can prepare for several citizenship exams at once. Progress is kept separately for each.',
    allCovered: 'You are already studying for every exam Oathly covers.',
    whichExam: 'Which exam are you preparing for?',
    searchCountries: 'Search countries',
    countryCount: '{count, plural, one {# country} other {# countries}}',
    countryCountFiltered: '{shown} of {total} countries',
    inLanguages: 'in {languages}',
    noCountryMatch:
      'No country matches “{query}”. Oathly adds countries as it verifies their exams.',
    countriesFailed:
      'We could not load the list of countries. Check your connection and try again.',
    examDate: 'When is your exam?',
    optional: '(optional)',
    examDateHint: 'We use it to pace your study plan.',
    examDateHintMobile:
      'Year-month-day, for example 2027-03-15. We use it to pace your study plan.',
    studyLanguage: 'Which language do you want to study in?',
    studyLanguageHint:
      'Questions appear in this language where a checked translation exists, and in the exam’s language otherwise.',
    dailyGoal: 'How long can you study each day?',
    minutesShort: '{count} min',
    makePrimary: 'Make this the exam the app opens on',
    start: 'Start studying',
    add: 'Add this exam',
    checkAnswers: 'Check your answers.',
  },

  dashboard: {
    metaTitle: 'Study | Oathly',
    greeting: 'Hi, {name}',
    title: 'Your study',
    todaysGoal: 'Today’s goal',
    goalProgress: 'of {goal} minutes',
    goalProgressToday: 'of {goal} minutes today',
    streak: 'Study streak',
    streakDays: '{count, plural, one {day in a row} other {days in a row}}',
    opensFirst: 'Opens first',
    questionsReady:
      '{count, plural, one {# question ready to study.} other {# questions ready to study.}}',
    questionsBeingChecked:
      'Questions for {country} are still being checked against the official guide. They appear here once a reviewer has verified them.',
    practise: 'Practise',
    mockExam: 'Mock exam',
    askTutor: 'Ask the tutor about {country}',
    stopStudying: 'Stop studying for this exam',
    addExam: 'Add another exam',
    loadFailed: 'We could not load your study plan.',
    loadingPlan: 'Loading your study plan',
  },

  readiness: {
    title: 'Estimated readiness',
    earlyEstimate: 'Early estimate',
    earlyTitle: 'Early estimate of readiness',
    meter: '{score}%, estimated',
    meterEarly: '{score}%, estimated, early estimate',
    basedOn:
      '{count, plural, one {Based on # question so far. It settles as you practise more.} other {Based on # questions so far. It settles as you practise more.}}',
    disclaimer:
      'This is an estimate from your practice and any mock exams, weighted like the real exam. It is not a guarantee of your result, and it drops if you stop reviewing.',
    topicKnowledge: 'Topic knowledge',
    recentMocks: 'Recent mock exams',
    noMocks: 'None yet',
    mockAverage: '{percent}% right',
    studyNext: 'What to study next',
    nothingStandsOut: 'Nothing stands out. Keep your daily practice going.',
    suggestStart: 'Start practising',
    suggestStartDetail: 'Your first set picks a mix of questions from every topic.',
    suggestReview:
      '{count, plural, one {Review # question you are about to forget} other {Review # questions you are about to forget}}',
    suggestReviewDetail: 'Answering them now, while they are due, is what makes them stick.',
    suggestTopicDetail: 'About {share}% of the exam, and you know {mastery}% of it well.',
    suggestMock: 'Take a mock exam',
    suggestMockDetail: '{exam}, timed like the real one.',
    start: 'Start',
    byTopic: 'By topic',
    shareOfExam: '({share}% of the exam)',
  },

  start: {
    questionsFrom: 'Questions from',
    adaptive: 'Made for me: weak topics, reviews and new',
    adaptiveDue: 'Made for me: weak topics, reviews and new ({count} due)',
    random: 'All topics, at random',
    howMany: 'How many',
    flashcards: 'Flashcards',
    startMock: 'Start mock exam',
    // Mobile dashboard.
    practiceIntro: 'Ten questions chosen for you: weak topics, reviews and new ones.',
    practiceIntroDue:
      'Ten questions chosen for you: weak topics, reviews ({count} due) and new ones.',
    oneTopic: 'Practise one topic',
    hideTopics: 'Hide topics',
    topicWithMastery: '{topic} ({mastery}%)',
  },

  session: {
    metaTitle: 'Study session | Oathly',
    practice: 'Practice',
    flashcards: 'Flashcards',
    mockExam: 'Mock exam',
    finishedTitle: 'This session is finished',
    finishedBody: 'Start a new one from your study page.',
    timeLeftMinutes: '{count, plural, one {Time left: # minute} other {Time left: # minutes}}',
    timeLeft: '{time} left',
    questionOf: 'Question {current} of {total}',
    progress: 'Progress',
    chooseOne: 'Choose one answer',
    chooseAll: 'Choose every correct answer',
    correct: 'Correct',
    notQuite: 'Not quite',
    check: 'Check',
    next: 'Next',
    submitExam: 'Submit exam',
    nextQuestion: 'Next question',
    seeResults: 'See results',
    keysChoose: 'Keys: 1–{count} to choose, Enter to confirm',
    keysContinue: 'Keys: Enter to continue',
    answer: 'Answer',
    answerInHead: 'Answer it in your head, then turn the card.',
    didNotKnow: 'I didn’t know',
    knewIt: 'I knew it',
    showAnswer: 'Show answer',
    keysRate: 'Keys: 1 or 2',
    keysTurn: 'Key: Enter or Space to turn',
    stillLearning: 'Still learning',
    swipeHint: 'Swipe the card right if you knew it, left if you are still learning it.',
    tapToShow: 'Tap to show the answer',
    leave: 'Leave',
    yourAnswer: 'Your answer',
    correctAnswer: 'Correct answer',
    fromGuide: 'From the official guide: “{quote}”',
    openFailedTitle: 'We could not open this session',
    openFailedBody: 'It may have been started on another device while this phone was offline.',
    loadingSession: 'Loading your session',
    // Reading a question in the other language.
    showInExamLanguage: 'Show in the exam’s language ({language})',
    showInStudyLanguage: 'Show in my study language ({language})',
    languageNote: 'The real exam is in {language}.',
  },

  results: {
    passed: 'You passed',
    notPassed: 'Not a pass this time',
    complete: 'Session complete',
    stoppedPassed: 'You have reached the pass mark, so the examiner would stop here.',
    stoppedFailed: 'Passing is no longer possible, so the examiner would stop here.',
    timeUp: 'Time is up.',
    timedOut: 'Time ran out before the last answers.',
    correctOf: 'of {total} correct.',
    knownOf: 'of {total} known.',
    neededToPass: '{count} needed to pass.',
    sectionAllCorrect: 'Every “{section}” question must be correct; {correct} of {total} were.',
    byTopic: 'By topic',
    topic: 'Topic',
    correctColumn: 'Correct',
    scoreOf: '{correct} of {total}',
    nothingToReview: 'Nothing to review',
    reviewCards: 'Cards to go over again',
    reviewWrong: 'Review your wrong answers',
    youAnswered: 'You answered: {answer}',
    nothing: 'nothing',
    correctAnswer: 'Correct answer: {answer}',
    source: 'source',
  },

  explain: {
    more: 'Explain more',
    writing: 'Writing an explanation…',
    aiNote:
      'Written by AI from the official guide’s passage. It has not been checked by a reviewer and may contain mistakes.',
  },

  tutor: {
    metaTitle: 'Ask the tutor | Oathly',
    title: 'Ask the tutor',
    intro:
      'Questions about the {country} citizenship test and its study material. The tutor answers from the official guide only, and is AI: check anything important against the guide. It cannot advise on your own application.',
    you: 'You:',
    tutor: 'Tutor:',
    questionLabel: 'Your question about the {country} test',
    ask: 'Ask',
    keys: 'Enter to send, Shift+Enter for a new line.',
    remaining: '{count, plural, one {# question left today.} other {# questions left today.}}',
    opening: 'Opening the tutor',
  },

  offline: {
    title: 'Study offline',
    saved:
      '{count, plural, one {# question saved on this phone, as of {date}. You can practise and take mock exams with no connection.} other {# questions saved on this phone, as of {date}. You can practise and take mock exams with no connection.}}',
    notSaved:
      'Save this country to your phone to practise and take mock exams with no connection. Your answers are sent when you are back online.',
    save: 'Save for offline',
    update: 'Update saved questions',
    bannerOfflineWaiting:
      '{count, plural, one {You are offline. # saved item will be sent when you are back online.} other {You are offline. # saved items will be sent when you are back online.}}',
    bannerOffline: 'You are offline. Saved countries still work.',
    bannerSending: '{count, plural, one {Sending # saved item…} other {Sending # saved items…}}',
    bannerWaiting:
      '{count, plural, one {# saved item waiting to be sent.} other {# saved items waiting to be sent.}}',
    progressLater: 'Your progress will show here when you are back online.',
    noConnection: 'No connection. Download this country while you are online to study without one.',
  },

  profile: {
    title: 'Your profile',
    tabStudy: 'Study',
    tabProfile: 'Profile',
    progress: 'Progress',
    sessions: 'Sessions',
    answered: 'Answered',
    correct: 'Correct',
    dailyGoal: 'Daily goal: {count} minutes.',
    yourExams: 'Your exams',
    studyingIn: 'Studying in {language}.',
    offline: 'Offline',
    noPacks:
      'No countries saved on this phone yet. Save one from the Study tab to practise with no connection.',
    packLine:
      '{count, plural, one {{country}: # question, saved {date}.} other {{country}: # questions, saved {date}.}}',
    removePack: 'Remove from this phone',
    allSaved: 'Everything you have answered is saved to your account.',
    waiting:
      '{count, plural, one {# saved item is waiting to be sent.} other {# saved items are waiting to be sent.}}',
    lastTry: 'Last try: {problem}',
    sendNow: 'Send now',
    appLanguage: 'App language',
    appLanguageHint:
      'The language of buttons and menus. The language you study questions in is set per exam.',
  },

  welcome: {
    countriesSoFar: '{count} countries so far.',
    getStarted: 'Get started',
    unreachable: 'We could not reach Oathly. Check your connection and try again.',
  },
};

export type Messages = typeof en;
