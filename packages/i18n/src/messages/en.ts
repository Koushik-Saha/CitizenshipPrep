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
    errorTitle: 'Something went wrong',
    errorBody:
      'This page could not be shown. Try again, and if it keeps happening, come back a little later.',
    notFoundTitle: 'Page not found',
    notFoundBody:
      'There is no page at this address. It may have moved, or the link may be mistyped.',
    backHome: 'Go to the home page',
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
      'Start free with a sample of each country’s questions. Pro opens everything; a Country Pass opens one country for good.',
    planFree: 'Free',
    planFreeNote: 'No card needed.',
    planAiAllowance: '{explanations} answer explanations and {messages} tutor messages a day',
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
      'A sample of each country’s questions is free, with practice, flashcards, the readiness score and audio mode. Pro, monthly or yearly, opens every question in every country and adds more AI help. A Country Pass is one payment that opens one country for good.',
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
    showAnswer: 'Show the answer',
    answerLabel: 'Answer:',
    fromGuide: 'From the official guide: “{quote}”',
    source: 'Source',
    moreInApp:
      '{count, plural, one {# more {topic} question, with explanations and spaced review, is waiting in Oathly.} other {# more {topic} questions, with explanations and spaced review, are waiting in Oathly.}}',
    practiseInApp: 'Practise with explanations, spaced review and mock exams in Oathly.',
    otherTopics: 'Other topics',
  },

  seo: {
    // The public test pages: /<country>/citizenship-test and its topics.
    lastChecked: 'Last checked against the official sources:',
    beingChecked: 'Being checked against the official sources.',
    factType: 'Type',
    typeWritten: 'Written test',
    typeOral: 'Oral test',
    typeInterview: 'Interview',
    typeLanguage: 'Language test',
    factQuestions: 'Questions',
    factPassMark: 'Pass mark',
    passMarkOf: '{pass} of {count} ({percent}%)',
    factTime: 'Time limit',
    factPool: 'Question pool',
    factNotes: 'Good to know',
    samplesTitle: '{count, plural, one {# free sample question} other {# free sample questions}}',
    samplesIntro: 'Answer each one in your head, then open the answer to see why it is right.',
    originalWording: 'As the test words it:',
    topicTitle: '{topic}: {country} citizenship test questions',
    allFacts: 'All the facts about the {country} citizenship test',
    faqTitle: 'Common questions',
    faqCountQ: 'How many questions are on the {country} citizenship test?',
    faqCountA:
      '{count, plural, one {The {exam} has # question.} other {The {exam} has # questions.}}',
    faqCountPoolA:
      '{count, plural, one {The {exam} has # question, drawn from a pool of {pool}.} other {The {exam} has # questions, drawn from a pool of {pool}.}}',
    faqPassQ: 'What score do you need to pass the {country} citizenship test?',
    faqPassA: 'To pass the {exam} you need {pass} correct answers out of {count} ({percent}%).',
    faqPassOnlyA:
      '{pass, plural, one {To pass the {exam} you need # correct answer.} other {To pass the {exam} you need # correct answers.}}',
    faqTimeQ: 'How long does the {country} citizenship test take?',
    faqTimeA:
      '{minutes, plural, one {You have # minute for the {exam}.} other {You have # minutes for the {exam}.}}',
    faqLanguageQ: 'What language is the {country} citizenship test in?',
    faqLanguageA: 'The test is taken in {languages}.',
    faqTopicsQ: 'What does the {country} citizenship test cover?',
    faqTopicsA:
      '{count, plural, one {Oathly’s practice questions cover # topic: {topics}.} other {Oathly’s practice questions cover # topics: {topics}.}}',
    faqSourceQ: 'Where do these practice questions come from?',
    faqSourceA:
      'Each question is written from the official study material, checked against it by a reviewer, and linked to its source. They are for practice: the questions you are asked on the day may be worded differently.',
    faqOfficialQ: 'Is Oathly an official government website?',
    faqOfficialA:
      'No. Oathly is an independent study app and is not affiliated with any government. To book the test or check the rules that apply to you, use the official website.',
    faqTopicQ: 'How can I practise {topic} questions for the {country} citizenship test?',
    faqTopicA:
      '{count, plural, one {Oathly has # checked practice question on {topic}. The sample on this page is free, with the answer explained.} other {Oathly has # checked practice questions on {topic}. The sample on this page is free, with the answers explained; the rest are in the app.}}',
    ogAlt: '{country} citizenship test: practice questions on Oathly',
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
    examResultAsk: 'How did your {country} test go?',
    examResultPassed: 'I passed',
    examResultFailed: 'Not this time',
    examResultCongrats: 'Congratulations on passing your {country} test.',
    examResultRetake:
      'Thank you for telling us. Keep practising, and set your new date when you have one.',
    examResultError: 'We could not save that. Try again.',
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

  audio: {
    mode: 'Audio mode',
    hint: 'Each question is read aloud. Answer by tapping, or aloud.',
    replay: 'Read it again',
    voiceAnswers: 'Answer by voice',
    speak: 'Answer aloud',
    stopListening: 'Stop listening',
    listening: 'Listening…',
    speaking: 'Reading aloud…',
    sayNumber: 'Say the number of your answer, or the answer itself.',
    heard: 'I heard: “{words}”',
    notCaught: 'That does not match any of the answers.',
    useAnswer: 'Use this answer',
    sayAgain: 'Say it again',
    showChoices: 'Choose from the answers instead',
    showQuestion: 'Show the question in writing',
    hideQuestion: 'Hide the written question',
    listenToQuestion: 'Listen to the question',
    micBlocked:
      'Oathly cannot use the microphone. Allow it in your settings, or answer by tapping.',
    voiceUnavailable: 'This device cannot take spoken answers. Answer by tapping.',
    correct: 'Correct.',
    notQuite: 'Not quite. The answer is:',
    interview: 'Mock interview',
    startInterview: 'Start mock interview',
    interviewIntro:
      'The questions are asked aloud, as in the real exam. Answer aloud, in the exam’s language.',
  },

  plans: {
    title: 'Plans',
    metaTitle: 'Plans | Oathly',
    yourPlan: 'Your plan',
    free: 'Free',
    pro: 'Pro',
    countryPass: 'Country Pass',
    freeSummary:
      'A sample of {count} questions from each country, with practice, flashcards, the readiness score and audio mode.',
    proSummary:
      'Every question in every country, full-length mock exams and mock interviews, and more AI help.',
    passSummary:
      'Every question for one country, with its full-length mock exams. One payment, yours to keep.',
    proNote: 'Monthly or yearly. Cancel any time.',
    passNote: 'One payment. No subscription.',
    perMonth: '{price} a month',
    perYear: '{price} a year',
    once: '{price}, once',
    getMonthly: 'Get Pro, monthly',
    getYearly: 'Get Pro, yearly',
    getPass: 'Get the pass for {country}',
    onPro: 'You have Pro.',
    renewsOn: 'It renews on {date}.',
    endsOn: 'It ends on {date} and will not renew.',
    passFor: 'Country Pass: {country}',
    manage: 'Manage billing',
    manageInStore: 'This subscription was bought in the {store}. Change or cancel it there.',
    boughtOnWeb: 'This subscription was bought on the Oathly website. Change or cancel it there.',
    unavailable: 'Plans cannot be bought here yet.',
    thanks: 'Thank you. Your plan will show here in a moment.',
    freeLimit: '{available} of {total} questions are included in the Free plan.',
    seePlans: 'See plans',
    examLocked: 'This exam needs more questions than the Free plan includes.',
    terms:
      'Pro renews until you cancel. If you cancel, you keep Pro until the end of the period you have paid for.',
    restore: 'Restore purchases',
    purchaseFailed: 'The purchase did not go through.',
    notInThisBuild: 'Purchases are not available in this build of the app.',
  },

  org: {
    metaTitle: 'Organizations | Oathly',
    title: 'Organizations',
    forOrganizations: 'For organizations',
    intro:
      'For law firms, schools and nonprofits helping people prepare. Invite your learners, give each a country and a date, and see who is ready and who needs a hand.',
    yours: 'Your organizations',
    roleOwner: 'Owner',
    roleAdmin: 'Admin',
    roleMember: 'Learner',
    open: 'Open',
    studyingWith: 'Studying with {organization}',
    adminsSee:
      'Its admins can see your readiness score and how much you study for the exam they assigned. They cannot see your individual answers.',
    leave: 'Leave {organization}',
    create: 'Create an organization',
    name: 'Organization name',
    kind: 'Kind of organization',
    kindLawFirm: 'Law firm',
    kindSchool: 'School',
    kindNonprofit: 'Nonprofit',
    kindOther: 'Other',
    createButton: 'Create',
    learners: 'Learners',
    invite: 'Invite',
    settings: 'Settings',
    allOrganizations: 'All organizations',

    seats: 'Seats',
    seatsUsed: '{used} of {total} in use',
    seatsPending: '{count, plural, one {# held by an invitation} other {# held by invitations}}',
    seatsAvailable: '{count, plural, one {# free} other {# free}}',
    seatsOver:
      '{count, plural, one {# learner has no seat and is on the Free plan.} other {# learners have no seat and are on the Free plan.}}',
    seatsNone: 'This organization has no seats yet. A learner needs a seat to be invited.',
    seatsExplain:
      'Each learner takes one seat and studies on Pro: every question, in every country.',
    seatsGranted:
      '{count, plural, one {# seat provided by Oathly.} other {# seats provided by Oathly.}}',
    seatCount: 'Number of seats',
    buySeats: 'Buy seats',
    perSeatMonth: '{price} per seat, per month',
    perSeatYear: '{price} per seat, per year',
    manageBilling: 'Change seats or billing',
    seatsRenew: 'Renews on {date}.',
    seatsEnd: 'Ends on {date} and will not renew.',
    seatsEnded: 'The subscription has ended.',
    billingUnavailable: 'Seats cannot be bought here yet.',
    seatsThanks: 'Thank you. Your seats will show here in a moment.',

    summaryReady: 'Ready',
    summaryBehind: 'Need attention',
    summaryActive: 'Active this week',
    summaryAverage: 'Average readiness',

    colLearner: 'Learner',
    colEmail: 'Email',
    colCountry: 'Country',
    colTargetDate: 'Target date',
    colDaysLeft: 'Days left',
    colReadiness: 'Readiness',
    colStanding: 'Standing',
    colLastActive: 'Last active',
    colThisWeek: 'This week',
    colAnswersWeek: 'Answers this week',
    colMinutesWeek: 'Minutes this week',
    colAnswers: 'Answers in all',
    colMockExams: 'Mock exams',
    colLastMock: 'Latest mock exam (%)',
    colJoined: 'Joined',
    standingReady: 'Ready',
    standingOnTrack: 'On track',
    standingBehind: 'Needs attention',
    standingNotStarted: 'Not started',
    never: 'Never',
    noDate: 'No date',
    notAssigned: 'Not assigned',
    noScore: 'No score yet',
    earlyEstimate: 'early estimate',
    thisWeek: '{answers, plural, one {# answer} other {# answers}}, {minutes} min',
    daysLeft: '{count, plural, one {# day left} other {# days left}}',
    datePassed: 'date has passed',
    noSeat: 'No seat',
    sortBy: 'Sort by',
    sortAttention: 'Needs attention first',
    sortName: 'Name',
    sortReadiness: 'Readiness',
    sortDate: 'Target date',
    sortActivity: 'Last active',
    noLearners:
      'No learners yet. Invite the people you are helping; they appear here once they join.',
    change: 'Change',
    save: 'Save',
    remove: 'Remove from organization',
    exportCsv: 'Download CSV',
    exportPdf: 'Print or save as PDF',
    readinessNote:
      'Readiness is the estimate each learner sees on their own dashboard, for the country you assigned. You do not see their individual answers.',

    inviteTitle: 'Invite people',
    inviteHelp:
      'Type or paste email addresses, one to a line, or upload a CSV file with the columns email, name, country and target date. Only email is needed.',
    inviteEmails: 'Email addresses',
    inviteFile: 'Or a CSV file',
    inviteCountry: 'Country, for lines that name none',
    inviteDate: 'Target date, for lines that give none',
    inviteNoCountry: 'No country',
    inviteRole: 'Invite as',
    inviteAsLearners: 'Learners',
    inviteAsAdmins: 'Admins, who can see every learner',
    inviteButton: 'Invite',
    inviteSent:
      '{count, plural, one {# invitation sent by email.} other {# invitations sent by email.}}',
    inviteNotSent:
      '{count, plural, one {# invitation is ready, but no email was sent. Send the link yourself.} other {# invitations are ready, but no email was sent. Send each link yourself.}}',
    inviteLinks: 'Invitation links',
    inviteLinkNote: 'Each link works once, for one person, and is shown only now.',
    inviteAlreadyMembers: 'Already members: {emails}',
    inviteNoSeats: 'No seat left for: {emails}',
    inviteProblems: 'Lines that could not be used',
    inviteLine: 'Line {line}: {value}',
    problemBadEmail: 'not an email address',
    problemDuplicate: 'listed twice',
    problemUnknownCountry: 'not a country Oathly covers',
    problemBadDate: 'write dates as YYYY-MM-DD',
    problemPastDate: 'the date has passed',
    inviteOverLimit: '{count} more were left out: one list can invite {limit} people.',
    inviteNothing: 'There was nobody on the list to invite.',
    pending: 'Pending invitations',
    invitedOn: 'Invited {date}',
    expiresOn: 'expires {date}',
    expired: 'Expired',
    resend: 'Send again',
    revoke: 'Withdraw',
    noPending: 'No invitations are waiting.',

    details: 'Details',
    saved: 'Saved.',
    branding: 'Your look on learners’ dashboards',
    brandingHelp:
      'Optional. Your logo and colours appear on the dashboards of the learners you invite. Shades are adjusted where needed so text stays readable.',
    brandColor: 'Main colour',
    brandAccent: 'Accent colour',
    colorHint: 'A hex colour such as #0b5fff. Leave empty to use Oathly’s.',
    logo: 'Logo',
    logoHint: 'PNG, JPEG or WebP, up to 256 KB.',
    logoUpload: 'Upload logo',
    logoRemove: 'Remove logo',
    logoAlt: '{organization} logo',
    preview: 'Preview',
    previewButton: 'Start practising',
    previewLink: 'See your progress',
    team: 'People who run this organization',

    errorInvalid: 'Check the details and try again.',
    errorForbidden: 'Your role in this organization does not allow that.',
    errorNotFound: 'That organization could not be found.',
    errorInviteGone:
      'This invitation has expired or been withdrawn. Ask whoever invited you for a new one.',
    errorWrongAddress:
      'This invitation was sent to a different email address. Open the link in the email instead.',
    errorBadLogo: 'The logo must be a PNG, JPEG or WebP image of at most 256 KB.',

    joinTitle: 'Join {organization}',
    joinInvited: '{organization} has invited you to study with them on Oathly.',
    joinInvitedAdmin: '{organization} has invited you to help run their organization on Oathly.',
    joinAssigned: 'They would like you to prepare for the citizenship test of {country}.',
    joinTarget: 'Target date: {date}.',
    joinIncludes: 'Your place includes Oathly Pro, at no cost to you.',
    joinConsent:
      'If you join, the admins of {organization} will see your readiness score and how much you study for that exam. They will not see your individual answers, and you can leave at any time.',
    joinButton: 'Join',
    joinSignIn: 'Sign in to join',
    joined: 'You have joined {organization}.',
    invitedBanner: '{organization} has invited you to study with them.',
    viewInvitation: 'Join',
    planFromOrg: 'Pro, provided by {organization}.',

    reportTitle: 'Learner readiness report',
    reportGenerated: 'Generated {date}',
    reportBack: 'Back to learners',

    emailSubject: '{organization} invited you to Oathly',
    emailHello: 'Hello,',
    emailHelloName: 'Hello {name},',
    emailBody:
      '{organization} has invited you to prepare for your citizenship test with Oathly. Your place is paid for.',
    emailBodyAdmin: '{organization} has invited you to help run their organization on Oathly.',
    emailAction: 'Accept the invitation',
    emailExpires: 'The link works once and expires in {days} days.',
    emailFooter:
      'Oathly is an independent study app. It is not affiliated with, or endorsed by, any government. If you were not expecting this message, you can ignore it.',
    inviteGoneTitle: 'Invitation not found',
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
    savingAudio: 'Saving audio: {done} of {total}',
    audioSaved:
      '{count, plural, one {# recording saved for audio mode.} other {# recordings saved for audio mode.}}',
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
