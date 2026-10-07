import type { Messages } from './en';

export const tl: Messages = {
  common: {
    signIn: 'Mag-sign in',
    signOut: 'Mag-sign out',
    countries: 'Mga bansa',
    allCountries: 'Lahat ng bansa',
    pricing: 'Presyo',
    faq: 'Mga tanong',
    backToStudy: 'Bumalik sa pag-aaral',
    tryAgain: 'Subukan ulit',
    loading: 'Naglo-load',
    language: 'Wika',
    mainNav: 'Pangunahin',
    footerNav: 'Footer',
    breadcrumb: 'Kinaroroonan',
    comingSoon: 'Malapit na',
    notAffiliated:
      'Ang Oathly ay isang independiyenteng app sa pag-aaral. Hindi ito kaugnay o ineendorso ng anumang gobyerno.',
  },

  exam: {
    factSeparator: ', ',
    questionCount: '{count, plural, one {# tanong} other {# tanong}}',
    toPass: '{count} para pumasa',
    minutes: '{count, plural, one {# minuto} other {# minuto}}',
    noTimeLimit: 'walang limitasyon sa oras',
    takenIn: 'Isinasagawa sa {languages}',
    officialSource: 'Opisyal na pinagmulan',
    checkedOn: 'sinuri noong {date}',
    detailsBeingChecked: 'sinusuri pa ang mga detalye',
    checkedQuestions:
      '{count, plural, one {# nasuring tanong sa pagsasanay} other {# nasuring tanong sa pagsasanay}}',
    questionsBeingChecked: 'Sinusuri pa ang mga tanong sa pagsasanay',
    studyFor: 'Mag-aral para sa {country}',
    countdownNone: 'Walang nakatakdang petsa ng pagsusulit',
    countdownPassed: 'Lumipas na ang petsa ng pagsusulit',
    countdownToday: 'Ngayong araw ang pagsusulit',
    countdownDays:
      '{count, plural, one {Bukas ang pagsusulit} other {Pagsusulit sa loob ng # araw}}',
  },

  landing: {
    metaTitle: 'Oathly: pagsasanay para sa citizenship test ng bawat bansa',
    metaDescription:
      'Magsanay para sa iyong citizenship test gamit ang mga tanong na sinuri laban sa mga opisyal na pinagmulan, mga sagot na ipinaliwanag sa simpleng salita, at pagtatantiya kung gaano ka na kahanda. Independiyente: hindi kaugnay ng anumang gobyerno.',
    heroTitle: 'Pumasok sa iyong citizenship test nang handa.',
    heroBody:
      'Mga tanong sa pagsasanay na isinulat mula sa opisyal na gabay ng bawat bansa, mga sagot na ipinaliwanag sa simpleng salita, at tapat na pagtatantiya kung gaano ka na kahanda.',
    startFree: 'Magsimulang mag-aral nang libre',
    seeCountries:
      '{count, plural, one {Tingnan ang mga bansa} other {Tingnan ang lahat ng # bansa}}',
    searchLabel: 'Citizenship test ng aling bansa ang kukunin mo?',
    searchNoMatch:
      'Wala pang tugma para sa “{query}”. Nagdaragdag kami ng bansa kapag nasuri na namin ang pagsusulit nito laban sa mga opisyal na pinagmulan.',
    searchStatusNone: 'Walang tugmang bansa.',
    searchStatus:
      '{count, plural, one {# tugmang bansa. Pindutin ang Tab para puntahan ito.} other {# tugmang bansa. Pindutin ang Tab para puntahan ang mga ito.}}',

    howTitle: 'Paano ito gumagana',
    step1Title: 'Piliin ang iyong bansa at pagsusulit',
    step1Body:
      'Sabihin sa amin kung aling pagsusulit ang kukunin mo, kailan, at sa anong wika mo gustong mag-aral.',
    step2Title: 'Magsanay nang kaunti araw-araw',
    step2Body:
      'Pinaghahalo ng bawat sesyon ang mga paksang pinakamahirap para sa iyo, mga tanong na oras nang balikan, at mga bago. May kasamang paliwanag at sipi mula sa opisyal na gabay ang mga maling sagot.',
    step3Title: 'Kumuha ng mock exam kapag malapit na',
    step3Body:
      'Sinusunod ng mga mock exam ang totoong format at pasadong marka. Ipinapakita ng iyong readiness score kung gaano ka na kalapit at kung ano ang susunod na aaralin.',

    countriesTitle: 'Mga bansa at pagsusulit',
    countriesIntro:
      'Nagdaragdag kami ng bansa kapag nasuri na ang format ng pagsusulit at mga materyales sa pag-aaral nito laban sa mga opisyal na pinagmulan. May mga parating pa.',
    countriesEmpty: 'Ina-update ang listahan ng mga bansa. Bumalik sa ilang sandali.',

    featuresTitle: 'Ginawa para sa pagsusulit na talagang kukunin mo',
    featuresIntro:
      'Karamihan sa mga citizenship app ay para sa iisang bansa na may nakapirming listahan ng mga tanong. Ang Oathly ay binuo batay sa mga opisyal na pinagmulan at sa kung paano talaga natututo ang mga tao.',
    feature1Title: 'Pagsusulit ng bawat bansa, iisang app',
    feature1Body:
      'Naghahanda para sa pagsusulit ng higit sa isang bansa? Mag-aral para sa bawat isa sa iisang account, na hiwalay ang progreso.',
    feature2Title: 'Sinuri laban sa opisyal na pinagmulan',
    feature2Body:
      'Bawat tanong ay may link sa pahina ng opisyal na gabay na pinagkunan nito at ipinapakita kung kailan ito huling sinuri. May taong nag-aapruba sa bawat isa bago mo ito makita.',
    feature3Title: 'Ipinaliliwanag ang mga sagot',
    feature3Body:
      'Itanong kung bakit tama ang isang sagot at makakuha ng maikling paliwanag batay sa opisyal na gabay, o magtanong pa sa tutor.',
    feature4Title: 'Pagsasanay na umaangkop sa iyo',
    feature4Body:
      'Nakatuon ang mga sesyon sa pinakamahihina mong paksa at ibinabalik ang mga tanong bago mo pa makalimutan.',
    feature5Title: 'Readiness score na mapagkakatiwalaan',
    feature5Body:
      'Isang pagtatantiyang tinimbang gaya ng totoong pagsusulit, at bumababa kapag tumigil kang mag-aral. Sinasabi nito kung ano ang dapat pagtuunan, hindi lang isang numero.',
    feature6Title: 'Mag-aral sa sarili mong wika',
    feature6Body:
      'Pumili mula sa {count} wika. Lumalabas ang mga tanong sa wika ng pagsusulit kapag wala pang nasuring salin.',
    feature7Title: 'Mga grupo sa pag-aaral',
    feature7Body: 'Maghanda kasama ang mga taong kukuha ng parehong pagsusulit.',
    feature8Title: 'Para sa mga paaralan at organisasyon',
    feature8Body:
      'Masusubaybayan ng mga klase at settlement service kung kumusta ang kanilang mga mag-aaral.',

    pricingTitle: 'Presyo',
    pricingIntro:
      'Magsimula nang libre gamit ang sample ng mga tanong ng bawat bansa. Binubuksan ng Pro ang lahat; binubuksan ng Country Pass ang isang bansa habambuhay.',
    planFree: 'Libre',
    planFreeNote: 'Hindi kailangan ng card.',
    planAiAllowance: '{explanations} paliwanag ng sagot at {messages} mensahe sa tutor bawat araw',
    planGroups:
      'Mga paaralan, aklatan at settlement service: malapit nang dumating ang mga plan para sa grupo.',

    storiesTitle: 'Ang sinasabi ng mga mag-aaral',
    storiesBody:
      'Bago pa lang ang Oathly kaya wala pang mga review. Kapag nakakuha na ng pagsusulit ang mga nag-aral dito, ilalagay namin dito ang kanilang mga salita. Mga totoo lang, at may pahintulot nila.',

    faqTitle: 'Mga tanong',
    faq1Question: 'Opisyal bang app ng gobyerno ang Oathly?',
    faq1Answer:
      'Hindi. Independiyente ang Oathly at hindi ito kaugnay o ineendorso ng anumang gobyerno. Para mag-book ng pagsusulit o alamin ang mga patakarang para sa iyo, gamitin ang opisyal na website ng iyong gobyerno.',
    faq2Question: 'Ito ba ang mga totoong tanong sa pagsusulit?',
    faq2Answer:
      'Inilalathala ng ilang bansa ang mismong mga tanong; ang iba naman ay naglalathala ng gabay sa pag-aaral at inililihim ang mga tanong. Alinman dito, bawat tanong sa Oathly ay isinulat mula sa opisyal na materyal, may link sa pahinang pinagkunan nito, at sinusuri ng tao bago mo ito makita.',
    faq3Question: 'Gaano katumpak ang readiness score?',
    faq3Answer:
      'Pagtatantiya ito, hindi hula sa iyong resulta. Nakabatay ito sa kung gaano mo kaalam ang bawat paksa, na tinimbang gaya ng iyong pagsusulit, at sa mga kamakailan mong mock exam. Bumababa ito kapag tumigil kang mag-aral, dahil nakakalimot tayo.',
    faq4Question: 'Maaari ba akong mag-aral sa sarili kong wika?',
    faq4Answer:
      'Oo. Makakapili ka mula sa {count} wika. Sinusuri ang mga salin bago lumabas; hangga’t wala pa, makikita mo ang tanong sa wika ng pagsusulit. Ang mismong pagsusulit ay nasa wikang itinakda ng iyong bansa.',
    faq5Question: 'Magkano ito?',
    faq5Answer:
      'Libre ang sample ng mga tanong ng bawat bansa, kasama ang pagsasanay, flashcard, readiness score at audio mode. Binubuksan ng Pro, buwanan o taunan, ang lahat ng tanong sa lahat ng bansa at nagdaragdag ng mas maraming tulong ng AI. Ang Country Pass ay isang bayad na nagbubukas ng isang bansa habambuhay.',
    faq6Question: 'Wala sa listahan ang bansa ko. Idaragdag ba ninyo ito?',
    faq6Answer:
      'Pinagsisikapan naming masakop ang bawat bansang may citizenship test. Idinaragdag namin ang bawat isa kapag nasuri na ang format ng pagsusulit at mga materyales sa pag-aaral nito laban sa mga opisyal na pinagmulan.',
  },

  countries: {
    indexMetaTitle: 'Mga citizenship test ayon sa bansa | Oathly',
    indexMetaDescription:
      'Ang mga citizenship test na tinutulungan ka ng Oathly na paghandaan: format, pasadong marka, mga wika at paksa, na bawat isa ay sinuri laban sa opisyal na pinagmulan.',
    countryTitle: 'Citizenship test ng {country}',
    countryMetaTitle: 'Citizenship test ng {country}: format, mga paksa at pagsasanay | Oathly',
    countryMetaDescription:
      'Kung ano ang nilalaman ng citizenship test ng {country}, ano ang saklaw nito, at mga tanong sa pagsasanay na sinuri laban sa opisyal na gabay.',
    countryLeadWithQuestions:
      '{count, plural, one {# tanong sa pagsasanay, sinuri laban sa opisyal na gabay.} other {# tanong sa pagsasanay, bawat isa ay sinuri laban sa opisyal na gabay.}}',
    countryLeadNoQuestions: 'Sinusuri pa ang mga tanong sa pagsasanay laban sa opisyal na gabay.',
    studyForTest: 'Mag-aral para sa pagsusulit ng {country}',
    theTest: 'Ang pagsusulit',
    formatBeingChecked: 'Sinusuri pa ang format ng pagsusulit.',
    whatItCovers: 'Ang saklaw nito',
    topicBeingChecked: 'Sinusuri pa',
    topicsBeingAdded: 'Idinaragdag pa ang mga paksa.',
    bookingNote:
      'Para mag-book ng pagsusulit o alamin ang mga patakarang para sa iyo, gamitin ang opisyal na website na naka-link sa itaas. Ang Oathly ay isang independiyenteng app sa pag-aaral at hindi kaugnay ng anumang gobyerno.',
    topicMetaTitle: '{topic}: pagsasanay sa citizenship test ng {country} | Oathly',
    topicMetaDescription:
      'Mga tanong sa pagsasanay tungkol sa {topic} para sa citizenship test ng {country}, bawat isa ay sinuri laban sa opisyal na gabay.',
    topicLead: 'Mga tanong sa pagsasanay para sa citizenship test ng {country}.',
    showAnswer: 'Ipakita ang sagot',
    answerLabel: 'Sagot:',
    fromGuide: 'Mula sa opisyal na gabay: “{quote}”',
    source: 'Pinagmulan',
    moreInApp:
      '{count, plural, one {# pang tanong sa {topic}, may mga paliwanag at spaced review, ang naghihintay sa Oathly.} other {# pang tanong sa {topic}, may mga paliwanag at spaced review, ang naghihintay sa Oathly.}}',
    practiseInApp: 'Magsanay nang may mga paliwanag, spaced review at mga mock exam sa Oathly.',
    otherTopics: 'Iba pang paksa',
  },

  seo: {
    lastChecked: 'Huling sinuri laban sa mga opisyal na pinagmulan:',
    beingChecked: 'Sinusuri pa laban sa mga opisyal na pinagmulan.',
    factType: 'Uri',
    typeWritten: 'Nakasulat na pagsusulit',
    typeOral: 'Pasalitang pagsusulit',
    typeInterview: 'Panayam',
    typeLanguage: 'Pagsusulit sa wika',
    factQuestions: 'Mga tanong',
    factPassMark: 'Pasadong marka',
    passMarkOf: '{pass} sa {count} ({percent}%)',
    factTime: 'Takdang oras',
    factPool: 'Kabuuang listahan ng tanong',
    factNotes: 'Mabuting malaman',
    samplesTitle:
      '{count, plural, one {# libreng halimbawang tanong} other {# libreng halimbawang tanong}}',
    samplesIntro:
      'Sagutin muna ang bawat isa sa isip, saka buksan ang sagot para makita kung bakit ito tama.',
    originalWording: 'Ganito ito sa pagsusulit:',
    topicTitle: '{topic}: mga tanong sa citizenship test ng {country}',
    allFacts: 'Lahat ng detalye tungkol sa citizenship test ng {country}',
    faqTitle: 'Mga madalas itanong',
    faqCountQ: 'Ilang tanong ang nasa citizenship test ng {country}?',
    faqCountA: '{count, plural, one {May # tanong ang {exam}.} other {May # tanong ang {exam}.}}',
    faqCountPoolA:
      '{count, plural, one {May # tanong ang {exam}, kinuha mula sa listahan ng {pool}.} other {May # tanong ang {exam}, kinuha mula sa listahan ng {pool}.}}',
    faqPassQ: 'Anong marka ang kailangan para pumasa sa citizenship test ng {country}?',
    faqPassA: 'Para pumasa sa {exam}, kailangan mo ng {pass} tamang sagot sa {count} ({percent}%).',
    faqPassOnlyA:
      '{pass, plural, one {Para pumasa sa {exam}, kailangan mo ng # tamang sagot.} other {Para pumasa sa {exam}, kailangan mo ng # tamang sagot.}}',
    faqTimeQ: 'Gaano katagal ang citizenship test ng {country}?',
    faqTimeA:
      '{minutes, plural, one {May # minuto ka para sa {exam}.} other {May # minuto ka para sa {exam}.}}',
    faqLanguageQ: 'Sa anong wika ang citizenship test ng {country}?',
    faqLanguageA: 'Ang pagsusulit ay kinukuha sa {languages}.',
    faqTopicsQ: 'Ano ang saklaw ng citizenship test ng {country}?',
    faqTopicsA:
      '{count, plural, one {Saklaw ng mga tanong sa pagsasanay ng Oathly ang # paksa: {topics}.} other {Saklaw ng mga tanong sa pagsasanay ng Oathly ang # paksa: {topics}.}}',
    faqSourceQ: 'Saan galing ang mga tanong sa pagsasanay na ito?',
    faqSourceA:
      'Bawat tanong ay isinulat mula sa opisyal na materyal sa pag-aaral, sinuri ng tagasuri laban dito, at may link sa pinagmulan. Para ito sa pagsasanay: maaaring iba ang pagkakasabi ng mga tanong sa araw ng pagsusulit.',
    faqOfficialQ: 'Opisyal na website ba ng gobyerno ang Oathly?',
    faqOfficialA:
      'Hindi. Ang Oathly ay malayang app sa pag-aaral at walang kaugnayan sa anumang gobyerno. Para mag-book ng pagsusulit o alamin ang mga patakarang angkop sa iyo, gamitin ang opisyal na website.',
    faqTopicQ:
      'Paano ako magsasanay sa mga tanong tungkol sa {topic} para sa citizenship test ng {country}?',
    faqTopicA:
      '{count, plural, one {May # nasuring tanong sa pagsasanay ang Oathly tungkol sa {topic}. Libre ang halimbawa sa pahinang ito, may paliwanag ang sagot.} other {May # nasuring tanong sa pagsasanay ang Oathly tungkol sa {topic}. Libre ang mga halimbawa sa pahinang ito, may paliwanag ang mga sagot; nasa app ang iba pa.}}',
    ogAlt: 'Citizenship test ng {country}: mga tanong sa pagsasanay sa Oathly',
  },

  auth: {
    metaTitle: 'Mag-sign in | Oathly',
    title: 'Mag-sign in sa Oathly',
    intro:
      'Bago ka rito? Gagawa ng account mo ang pag-sign in. Doon nase-save ang iyong progreso, kaya maipagpapatuloy mo ito sa telepono o sa ibang computer.',
    notConfigured: 'Hindi pa naka-set up ang pag-sign in sa server na ito.',
    email: 'Email',
    sendLink: 'I-email sa akin ang link sa pag-sign in',
    or: 'o',
    google: 'Magpatuloy gamit ang Google',
    sentTitle: 'Tingnan ang iyong email',
    sentBody:
      'Nagpadala kami ng link sa pag-sign in sa {email}. Isang beses lang itong gagana at malapit nang mag-expire. Maaari mo nang isara ang tab na ito.',
    differentEmail: 'Gumamit ng ibang email',
    sendFailed: 'Hindi namin naipadala ang link. Subukan ulit.',
    googleFailed: 'Hindi natuloy ang pag-sign in sa Google. Subukan ulit.',
    introMobile:
      'Bago ka rito? Gagawa ng account mo ang pag-sign in. Gamitin ang parehong email na gamit mo sa web at susunod sa iyo ang iyong progreso.',
    emailRequired: 'Ilagay ang iyong email address.',
    sendCode: 'I-email sa akin ang code',
    codeSent: 'Nagpadala kami ng anim na digit na code sa {email}. Malapit na itong mag-expire.',
    code: 'Code',
    verifyCode: 'Mag-sign in',
    codeFailed: 'Hindi gumana ang code na iyon. Suriin ito at subukan ulit.',
  },

  onboarding: {
    metaTitle: 'I-set up ang iyong pag-aaral | Oathly',
    title: 'I-set up ang iyong pag-aaral',
    titleAdd: 'Magdagdag ng isa pang pagsusulit',
    intro:
      'Apat na tanong, pagkatapos ay makakapagsimula ka na. Mababago mo ang lahat ng ito mamaya.',
    introAdd:
      'Maaari kang maghanda para sa ilang citizenship test nang sabay-sabay. Hiwalay na itinatago ang progreso para sa bawat isa.',
    allCovered: 'Nag-aaral ka na para sa bawat pagsusulit na sakop ng Oathly.',
    whichExam: 'Aling pagsusulit ang pinaghahandaan mo?',
    searchCountries: 'Maghanap ng bansa',
    countryCount: '{count, plural, one {# bansa} other {# bansa}}',
    countryCountFiltered: '{shown} sa {total} bansa',
    inLanguages: 'sa {languages}',
    noCountryMatch:
      'Walang bansang tumutugma sa “{query}”. Nagdaragdag ang Oathly ng mga bansa habang nabe-verify ang kanilang mga pagsusulit.',
    countriesFailed:
      'Hindi namin na-load ang listahan ng mga bansa. Suriin ang iyong koneksyon at subukan ulit.',
    examDate: 'Kailan ang iyong pagsusulit?',
    optional: '(opsiyonal)',
    examDateHint: 'Ginagamit namin ito para itakda ang bilis ng iyong plano sa pag-aaral.',
    examDateHintMobile:
      'Taon-buwan-araw, halimbawa 2027-03-15. Ginagamit namin ito para itakda ang bilis ng iyong plano sa pag-aaral.',
    studyLanguage: 'Sa anong wika mo gustong mag-aral?',
    studyLanguageHint:
      'Lumalabas ang mga tanong sa wikang ito kapag may nasuring salin, at sa wika ng pagsusulit kung wala.',
    dailyGoal: 'Gaano katagal ka makakapag-aral bawat araw?',
    minutesShort: '{count} min',
    makePrimary: 'Gawin itong pagsusulit na unang bubukas sa app',
    start: 'Magsimulang mag-aral',
    add: 'Idagdag ang pagsusulit na ito',
    checkAnswers: 'Suriin ang iyong mga sagot.',
  },

  dashboard: {
    metaTitle: 'Pag-aaral | Oathly',
    greeting: 'Kumusta, {name}',
    title: 'Ang iyong pag-aaral',
    todaysGoal: 'Layunin ngayong araw',
    goalProgress: 'sa {goal} minuto',
    goalProgressToday: 'sa {goal} minuto ngayong araw',
    streak: 'Sunod-sunod na pag-aaral',
    streakDays: '{count, plural, one {araw na sunod-sunod} other {araw na sunod-sunod}}',
    opensFirst: 'Unang bumubukas',
    questionsReady:
      '{count, plural, one {# tanong ang handa nang pag-aralan.} other {# tanong ang handa nang pag-aralan.}}',
    questionsBeingChecked:
      'Sinusuri pa ang mga tanong para sa {country} laban sa opisyal na gabay. Lalabas ang mga ito rito kapag na-verify na ng isang reviewer.',
    practise: 'Magsanay',
    mockExam: 'Mock exam',
    askTutor: 'Magtanong sa tutor tungkol sa {country}',
    stopStudying: 'Itigil ang pag-aaral para sa pagsusulit na ito',
    addExam: 'Magdagdag ng isa pang pagsusulit',
    loadFailed: 'Hindi namin na-load ang iyong plano sa pag-aaral.',
    loadingPlan: 'Nilo-load ang iyong plano sa pag-aaral',
  },

  readiness: {
    title: 'Tinatayang kahandaan',
    earlyEstimate: 'Paunang tantiya',
    earlyTitle: 'Paunang tantiya ng kahandaan',
    meter: '{score}%, tantiya',
    meterEarly: '{score}%, tantiya, paunang tantiya',
    basedOn:
      '{count, plural, one {Batay sa # tanong sa ngayon. Titiyak ito habang nagsasanay ka pa.} other {Batay sa # tanong sa ngayon. Titiyak ito habang nagsasanay ka pa.}}',
    disclaimer:
      'Ito ay tantiya mula sa iyong pagsasanay at mga mock exam, na tinimbang gaya ng totoong pagsusulit. Hindi ito garantiya ng iyong resulta, at bumababa ito kapag tumigil kang magbalik-aral.',
    topicKnowledge: 'Kaalaman sa mga paksa',
    recentMocks: 'Mga kamakailang mock exam',
    noMocks: 'Wala pa',
    mockAverage: '{percent}% tama',
    studyNext: 'Ano ang susunod na aaralin',
    nothingStandsOut: 'Walang namumukod. Ituloy ang araw-araw mong pagsasanay.',
    suggestStart: 'Magsimulang magsanay',
    suggestStartDetail: 'Pinaghahalo ng una mong set ang mga tanong mula sa bawat paksa.',
    suggestReview:
      '{count, plural, one {Balikan ang # tanong na malapit mo nang makalimutan} other {Balikan ang # tanong na malapit mo nang makalimutan}}',
    suggestReviewDetail: 'Ang pagsagot ngayon, habang oras na nila, ang nagpapatanim sa mga ito.',
    suggestTopicDetail: 'Mga {share}% ng pagsusulit, at alam mo nang mabuti ang {mastery}% nito.',
    suggestMock: 'Kumuha ng mock exam',
    suggestMockDetail: '{exam}, may oras gaya ng totoo.',
    start: 'Simulan',
    byTopic: 'Ayon sa paksa',
    shareOfExam: '({share}% ng pagsusulit)',
  },

  start: {
    questionsFrom: 'Mga tanong mula sa',
    adaptive: 'Para sa akin: mahihinang paksa, balik-aral at bago',
    adaptiveDue: 'Para sa akin: mahihinang paksa, balik-aral at bago ({count} ang nakatakda)',
    random: 'Lahat ng paksa, random',
    howMany: 'Ilan',
    flashcards: 'Mga flashcard',
    startMock: 'Simulan ang mock exam',
    practiceIntro:
      'Sampung tanong na pinili para sa iyo: mahihinang paksa, balik-aral at mga bago.',
    practiceIntroDue:
      'Sampung tanong na pinili para sa iyo: mahihinang paksa, balik-aral ({count} ang nakatakda) at mga bago.',
    oneTopic: 'Magsanay sa isang paksa',
    hideTopics: 'Itago ang mga paksa',
    topicWithMastery: '{topic} ({mastery}%)',
  },

  session: {
    metaTitle: 'Sesyon ng pag-aaral | Oathly',
    practice: 'Pagsasanay',
    flashcards: 'Mga flashcard',
    mockExam: 'Mock exam',
    finishedTitle: 'Tapos na ang sesyong ito',
    finishedBody: 'Magsimula ng bago mula sa iyong pahina ng pag-aaral.',
    timeLeftMinutes:
      '{count, plural, one {Natitirang oras: # minuto} other {Natitirang oras: # minuto}}',
    timeLeft: '{time} ang natitira',
    questionOf: 'Tanong {current} sa {total}',
    progress: 'Progreso',
    chooseOne: 'Pumili ng isang sagot',
    chooseAll: 'Piliin ang bawat tamang sagot',
    correct: 'Tama',
    notQuite: 'Hindi pa tama',
    check: 'Suriin',
    next: 'Susunod',
    submitExam: 'Ipasa ang pagsusulit',
    nextQuestion: 'Susunod na tanong',
    seeResults: 'Tingnan ang resulta',
    keysChoose: 'Mga key: 1–{count} para pumili, Enter para kumpirmahin',
    keysContinue: 'Mga key: Enter para magpatuloy',
    answer: 'Sagot',
    answerInHead: 'Sagutin ito sa isip mo, saka baligtarin ang card.',
    didNotKnow: 'Hindi ko alam',
    knewIt: 'Alam ko',
    showAnswer: 'Ipakita ang sagot',
    keysRate: 'Mga key: 1 o 2',
    keysTurn: 'Key: Enter o Space para baligtarin',
    stillLearning: 'Inaaral pa',
    swipeHint: 'I-swipe ang card pakanan kung alam mo, pakaliwa kung inaaral mo pa.',
    tapToShow: 'I-tap para makita ang sagot',
    leave: 'Umalis',
    yourAnswer: 'Ang sagot mo',
    correctAnswer: 'Tamang sagot',
    fromGuide: 'Mula sa opisyal na gabay: “{quote}”',
    openFailedTitle: 'Hindi namin mabuksan ang sesyong ito',
    openFailedBody: 'Maaaring sinimulan ito sa ibang device habang offline ang teleponong ito.',
    loadingSession: 'Nilo-load ang iyong sesyon',
    showInExamLanguage: 'Ipakita sa wika ng pagsusulit ({language})',
    showInStudyLanguage: 'Ipakita sa wika ko ng pag-aaral ({language})',
    languageNote: 'Ang totoong pagsusulit ay nasa {language}.',
  },

  results: {
    passed: 'Pumasa ka',
    notPassed: 'Hindi pumasa sa pagkakataong ito',
    complete: 'Tapos na ang sesyon',
    stoppedPassed: 'Naabot mo na ang pasadong marka, kaya dito na titigil ang tagasuri.',
    stoppedFailed: 'Hindi na posibleng pumasa, kaya dito na titigil ang tagasuri.',
    timeUp: 'Ubos na ang oras.',
    timedOut: 'Naubos ang oras bago ang mga huling sagot.',
    correctOf: 'sa {total} ang tama.',
    knownOf: 'sa {total} ang alam.',
    neededToPass: '{count} ang kailangan para pumasa.',
    sectionAllCorrect:
      'Dapat tama ang lahat ng tanong sa “{section}”; {correct} sa {total} ang tama.',
    byTopic: 'Ayon sa paksa',
    topic: 'Paksa',
    correctColumn: 'Tama',
    scoreOf: '{correct} sa {total}',
    nothingToReview: 'Walang kailangang balikan',
    reviewCards: 'Mga card na babalikan',
    reviewWrong: 'Balikan ang mga mali mong sagot',
    youAnswered: 'Ang sagot mo: {answer}',
    nothing: 'wala',
    correctAnswer: 'Tamang sagot: {answer}',
    source: 'pinagmulan',
  },

  explain: {
    more: 'Ipaliwanag pa',
    writing: 'Isinusulat ang paliwanag…',
    aiNote:
      'Isinulat ng AI mula sa sipi ng opisyal na gabay. Hindi pa ito nasuri ng reviewer at maaaring may mga mali.',
  },

  tutor: {
    metaTitle: 'Magtanong sa tutor | Oathly',
    title: 'Magtanong sa tutor',
    intro:
      'Mga tanong tungkol sa citizenship test ng {country} at sa mga materyales nito sa pag-aaral. Sumasagot lang ang tutor mula sa opisyal na gabay, at AI ito: i-check sa gabay ang anumang mahalaga. Hindi ito makapagpapayo tungkol sa sarili mong aplikasyon.',
    you: 'Ikaw:',
    tutor: 'Tutor:',
    questionLabel: 'Ang tanong mo tungkol sa pagsusulit ng {country}',
    ask: 'Itanong',
    keys: 'Enter para ipadala, Shift+Enter para sa bagong linya.',
    remaining:
      '{count, plural, one {# tanong na lang ngayong araw.} other {# tanong na lang ngayong araw.}}',
    opening: 'Binubuksan ang tutor',
  },

  audio: {
    mode: 'Audio mode',
    hint: 'Binabasa nang malakas ang bawat tanong. Sumagot sa pag-tap o sa pagsasalita.',
    replay: 'Basahin ulit',
    voiceAnswers: 'Sumagot gamit ang boses',
    speak: 'Sumagot nang malakas',
    stopListening: 'Itigil ang pakikinig',
    listening: 'Nakikinig…',
    speaking: 'Binabasa nang malakas…',
    sayNumber: 'Sabihin ang numero ng sagot mo, o ang mismong sagot.',
    heard: 'Ang narinig ko: “{words}”',
    notCaught: 'Hindi iyon tumutugma sa alinman sa mga sagot.',
    useAnswer: 'Gamitin ang sagot na ito',
    sayAgain: 'Sabihin ulit',
    showChoices: 'Pumili na lang mula sa mga sagot',
    showQuestion: 'Ipakita ang tanong nang nakasulat',
    hideQuestion: 'Itago ang nakasulat na tanong',
    listenToQuestion: 'Pakinggan ang tanong',
    micBlocked:
      'Hindi magamit ng Oathly ang mikropono. Payagan ito sa iyong settings, o sumagot sa pag-tap.',
    voiceUnavailable:
      'Hindi tumatanggap ng binigkas na sagot ang device na ito. Sumagot sa pag-tap.',
    correct: 'Tama.',
    notQuite: 'Hindi pa tama. Ang sagot ay:',
    interview: 'Mock interview',
    startInterview: 'Simulan ang mock interview',
    interviewIntro:
      'Itinatanong nang malakas ang mga tanong, gaya ng sa totoong pagsusulit. Sumagot nang malakas, sa wika ng pagsusulit.',
  },

  plans: {
    title: 'Mga plan',
    metaTitle: 'Mga plan | Oathly',
    yourPlan: 'Ang plan mo',
    free: 'Libre',
    pro: 'Pro',
    countryPass: 'Country Pass',
    freeSummary:
      'Sample na {count} tanong mula sa bawat bansa, may pagsasanay, flashcard, readiness score at audio mode.',
    proSummary:
      'Lahat ng tanong sa lahat ng bansa, buong mock exam at mock interview, at mas maraming tulong ng AI.',
    passSummary:
      'Lahat ng tanong para sa isang bansa, kasama ang buong mock exam nito. Isang bayad lang, sa iyo na habambuhay.',
    proNote: 'Buwanan o taunan. Kanselahin anumang oras.',
    passNote: 'Isang bayad lang. Walang subscription.',
    perMonth: '{price} bawat buwan',
    perYear: '{price} bawat taon',
    once: '{price}, isang beses lang',
    getMonthly: 'Kunin ang Pro, buwanan',
    getYearly: 'Kunin ang Pro, taunan',
    getPass: 'Kunin ang pass para sa {country}',
    onPro: 'May Pro ka.',
    renewsOn: 'Magre-renew ito sa {date}.',
    endsOn: 'Matatapos ito sa {date} at hindi na magre-renew.',
    passFor: 'Country Pass: {country}',
    manage: 'Pamahalaan ang billing',
    manageInStore: 'Binili ang subscription na ito sa {store}. Doon ito palitan o kanselahin.',
    boughtOnWeb:
      'Binili ang subscription na ito sa website ng Oathly. Doon ito palitan o kanselahin.',
    unavailable: 'Hindi pa mabibili ang mga plan dito.',
    thanks: 'Salamat. Lalabas dito ang plan mo sa ilang sandali.',
    freeLimit: 'Kasama sa Libreng plan ang {available} sa {total} tanong.',
    seePlans: 'Tingnan ang mga plan',
    examLocked:
      'Kailangan ng pagsusulit na ito ng mas maraming tanong kaysa sa kasama sa Libreng plan.',
    terms:
      'Nagre-renew ang Pro hanggang kanselahin mo. Kapag kinansela mo, mananatili ang Pro hanggang sa katapusan ng panahong nabayaran mo na.',
    restore: 'I-restore ang mga binili',
    purchaseFailed: 'Hindi natuloy ang pagbili.',
    notInThisBuild: 'Hindi available ang pagbili sa build na ito ng app.',
  },

  org: {
    metaTitle: 'Mga organisasyon | Oathly',
    title: 'Mga organisasyon',
    forOrganizations: 'Para sa mga organisasyon',
    intro:
      'Para sa mga law firm, paaralan at nonprofit na tumutulong sa mga taong naghahanda. Imbitahan ang iyong mga mag-aaral, bigyan ang bawat isa ng bansa at petsa, at tingnan kung sino ang handa na at sino ang nangangailangan ng tulong.',
    yours: 'Ang mga organisasyon mo',
    roleOwner: 'May-ari',
    roleAdmin: 'Admin',
    roleMember: 'Mag-aaral',
    open: 'Buksan',
    studyingWith: 'Nag-aaral ka kasama ang {organization}',
    adminsSee:
      'Nakikita ng mga admin nito ang iyong marka ng kahandaan at kung gaano ka nag-aaral para sa pagsusulit na itinakda nila. Hindi nila nakikita ang bawat sagot mo.',
    leave: 'Umalis sa {organization}',
    create: 'Gumawa ng organisasyon',
    name: 'Pangalan ng organisasyon',
    kind: 'Uri ng organisasyon',
    kindLawFirm: 'Law firm',
    kindSchool: 'Paaralan',
    kindNonprofit: 'Nonprofit',
    kindOther: 'Iba pa',
    createButton: 'Gumawa',
    learners: 'Mga mag-aaral',
    invite: 'Mag-imbita',
    settings: 'Mga setting',
    allOrganizations: 'Lahat ng organisasyon',
    seats: 'Mga upuan',
    seatsUsed: '{used} sa {total} ang gamit',
    seatsPending:
      '{count, plural, one {# nakalaan sa imbitasyon} other {# nakalaan sa mga imbitasyon}}',
    seatsAvailable: '{count, plural, one {# bakante} other {# bakante}}',
    seatsOver:
      '{count, plural, one {# mag-aaral ang walang upuan at nasa Libreng plan.} other {# mag-aaral ang walang upuan at nasa Libreng plan.}}',
    seatsNone:
      'Wala pang upuan ang organisasyong ito. Kailangan ng upuan para maimbitahan ang isang mag-aaral.',
    seatsExplain:
      'Isang upuan ang bawat mag-aaral, at nag-aaral sila sa Pro: lahat ng tanong, sa lahat ng bansa.',
    seatsGranted:
      '{count, plural, one {# upuan ang bigay ng Oathly.} other {# upuan ang bigay ng Oathly.}}',
    seatCount: 'Bilang ng upuan',
    buySeats: 'Bumili ng upuan',
    perSeatMonth: '{price} bawat upuan, bawat buwan',
    perSeatYear: '{price} bawat upuan, bawat taon',
    manageBilling: 'Baguhin ang upuan o billing',
    seatsRenew: 'Mare-renew sa {date}.',
    seatsEnd: 'Matatapos sa {date} at hindi na mare-renew.',
    seatsEnded: 'Tapos na ang subscription.',
    billingUnavailable: 'Hindi pa makakabili ng upuan dito.',
    seatsThanks: 'Salamat. Lalabas dito ang mga upuan mo sa ilang sandali.',
    summaryReady: 'Handa na',
    summaryBehind: 'Kailangang tutukan',
    summaryActive: 'Aktibo ngayong linggo',
    summaryAverage: 'Karaniwang kahandaan',
    colLearner: 'Mag-aaral',
    colEmail: 'Email',
    colCountry: 'Bansa',
    colTargetDate: 'Target na petsa',
    colDaysLeft: 'Mga araw na natitira',
    colReadiness: 'Kahandaan',
    colStanding: 'Kalagayan',
    colLastActive: 'Huling nag-aral',
    colThisWeek: 'Ngayong linggo',
    colAnswersWeek: 'Mga sagot ngayong linggo',
    colMinutesWeek: 'Mga minuto ngayong linggo',
    colAnswers: 'Kabuuang sagot',
    colMockExams: 'Mga mock exam',
    colLastMock: 'Pinakahuling mock exam (%)',
    colJoined: 'Sumali noong',
    standingReady: 'Handa na',
    standingOnTrack: 'Nasa tamang takbo',
    standingBehind: 'Kailangang tutukan',
    standingNotStarted: 'Hindi pa nagsisimula',
    never: 'Hindi pa',
    noDate: 'Walang petsa',
    notAssigned: 'Wala pang itinakda',
    noScore: 'Wala pang marka',
    earlyEstimate: 'paunang tantiya',
    thisWeek: '{answers, plural, one {# sagot} other {# sagot}}, {minutes} min',
    daysLeft: '{count, plural, one {# araw na lang} other {# araw na lang}}',
    datePassed: 'lumipas na ang petsa',
    noSeat: 'Walang upuan',
    sortBy: 'Ayusin ayon sa',
    sortAttention: 'Unahin ang kailangang tutukan',
    sortName: 'Pangalan',
    sortReadiness: 'Kahandaan',
    sortDate: 'Target na petsa',
    sortActivity: 'Huling nag-aral',
    noLearners:
      'Wala pang mag-aaral. Imbitahan ang mga taong tinutulungan mo; lalabas sila rito kapag sumali na.',
    change: 'Baguhin',
    save: 'I-save',
    remove: 'Alisin sa organisasyon',
    exportCsv: 'I-download ang CSV',
    exportPdf: 'I-print o i-save bilang PDF',
    readinessNote:
      'Ang kahandaan ay ang tantiyang nakikita ng bawat mag-aaral sa sarili niyang dashboard, para sa bansang itinakda mo. Hindi mo nakikita ang bawat sagot nila.',
    inviteTitle: 'Mag-imbita ng mga tao',
    inviteHelp:
      'I-type o i-paste ang mga email address, isa bawat linya, o mag-upload ng CSV file na may mga column na email, name, country at target date. Email lang ang kailangan.',
    inviteEmails: 'Mga email address',
    inviteFile: 'O isang CSV file',
    inviteCountry: 'Bansa, para sa mga linyang walang nakasulat',
    inviteDate: 'Target na petsa, para sa mga linyang walang nakasulat',
    inviteNoCountry: 'Walang bansa',
    inviteRole: 'Imbitahan bilang',
    inviteAsLearners: 'Mga mag-aaral',
    inviteAsAdmins: 'Mga admin, na nakakakita sa lahat ng mag-aaral',
    inviteButton: 'Imbitahan',
    inviteSent:
      '{count, plural, one {# imbitasyon ang naipadala sa email.} other {# imbitasyon ang naipadala sa email.}}',
    inviteNotSent:
      '{count, plural, one {Handa na ang # imbitasyon, pero walang naipadalang email. Ikaw na ang magpadala ng link.} other {Handa na ang # imbitasyon, pero walang naipadalang email. Ikaw na ang magpadala ng bawat link.}}',
    inviteLinks: 'Mga link ng imbitasyon',
    inviteLinkNote:
      'Isang beses lang gumagana ang bawat link, para sa isang tao, at ngayon lang ito ipinapakita.',
    inviteAlreadyMembers: 'Miyembro na: {emails}',
    inviteNoSeats: 'Wala nang upuan para kay: {emails}',
    inviteProblems: 'Mga linyang hindi nagamit',
    inviteLine: 'Linya {line}: {value}',
    problemBadEmail: 'hindi email address',
    problemDuplicate: 'dalawang beses nakalista',
    problemUnknownCountry: 'hindi bansang saklaw ng Oathly',
    problemBadDate: 'isulat ang petsa bilang YYYY-MM-DD',
    problemPastDate: 'lumipas na ang petsa',
    inviteOverLimit:
      '{count} pa ang hindi naisama: {limit} tao ang kayang imbitahan ng isang listahan.',
    inviteNothing: 'Walang maiimbitahan sa listahan.',
    pending: 'Mga nakabinbing imbitasyon',
    invitedOn: 'Inimbitahan noong {date}',
    expiresOn: 'mag-e-expire sa {date}',
    expired: 'Expired na',
    resend: 'Ipadala ulit',
    revoke: 'Bawiin',
    noPending: 'Walang nakabinbing imbitasyon.',
    details: 'Mga detalye',
    saved: 'Na-save.',
    branding: 'Ang hitsura mo sa dashboard ng mga mag-aaral',
    brandingHelp:
      'Opsyonal. Lalabas ang logo at mga kulay mo sa dashboard ng mga mag-aaral na inimbitahan mo. Inaayos ang tingkad ng kulay kung kailangan para madaling mabasa ang teksto.',
    brandColor: 'Pangunahing kulay',
    brandAccent: 'Kulay na pang-diin',
    colorHint: 'Hex na kulay gaya ng #0b5fff. Iwanang blangko para gamitin ang sa Oathly.',
    logo: 'Logo',
    logoHint: 'PNG, JPEG o WebP, hanggang 256 KB.',
    logoUpload: 'Mag-upload ng logo',
    logoRemove: 'Alisin ang logo',
    logoAlt: 'Logo ng {organization}',
    preview: 'Preview',
    previewButton: 'Simulan ang pagsasanay',
    previewLink: 'Tingnan ang progreso mo',
    team: 'Mga taong nagpapatakbo ng organisasyong ito',
    errorInvalid: 'Suriin ang mga detalye at subukan ulit.',
    errorForbidden: 'Hindi iyan pinapayagan ng tungkulin mo sa organisasyong ito.',
    errorNotFound: 'Hindi nahanap ang organisasyong iyon.',
    errorInviteGone:
      'Nag-expire na o binawi na ang imbitasyong ito. Humingi ng bago sa nag-imbita sa iyo.',
    errorWrongAddress:
      'Ipinadala ang imbitasyong ito sa ibang email address. Buksan ang link na nasa email.',
    errorBadLogo: 'Dapat PNG, JPEG o WebP na larawan ang logo, hanggang 256 KB.',
    joinTitle: 'Sumali sa {organization}',
    joinInvited: 'Inimbitahan ka ng {organization} na mag-aral kasama nila sa Oathly.',
    joinInvitedAdmin:
      'Inimbitahan ka ng {organization} na tumulong sa pagpapatakbo ng kanilang organisasyon sa Oathly.',
    joinAssigned:
      'Gusto nilang maghanda ka para sa pagsusulit sa pagkamamamayan ng bansang ito: {country}.',
    joinTarget: 'Target na petsa: {date}.',
    joinIncludes: 'Kasama sa upuan mo ang Oathly Pro, nang wala kang babayaran.',
    joinConsent:
      'Kapag sumali ka, makikita ng mga admin ng {organization} ang iyong marka ng kahandaan at kung gaano ka nag-aaral para sa pagsusulit na iyon. Hindi nila makikita ang bawat sagot mo, at puwede kang umalis anumang oras.',
    joinButton: 'Sumali',
    joinSignIn: 'Mag-sign in para sumali',
    joined: 'Sumali ka na sa {organization}.',
    invitedBanner: 'Inimbitahan ka ng {organization} na mag-aral kasama nila.',
    viewInvitation: 'Sumali',
    planFromOrg: 'Pro, mula sa {organization}.',
    reportTitle: 'Ulat ng kahandaan ng mga mag-aaral',
    reportGenerated: 'Ginawa noong {date}',
    reportBack: 'Bumalik sa mga mag-aaral',
    emailSubject: 'Inimbitahan ka ng {organization} sa Oathly',
    emailHello: 'Kumusta,',
    emailHelloName: 'Kumusta, {name},',
    emailBody:
      'Inimbitahan ka ng {organization} na maghanda para sa iyong pagsusulit sa pagkamamamayan gamit ang Oathly. Bayad na ang upuan mo.',
    emailBodyAdmin:
      'Inimbitahan ka ng {organization} na tumulong sa pagpapatakbo ng kanilang organisasyon sa Oathly.',
    emailAction: 'Tanggapin ang imbitasyon',
    emailExpires: 'Isang beses lang gumagana ang link at mag-e-expire sa loob ng {days} araw.',
    emailFooter:
      'Ang Oathly ay isang independiyenteng app sa pag-aaral. Hindi ito kaanib ng, o ineendorso ng, anumang pamahalaan. Kung hindi mo inaasahan ang mensaheng ito, puwede mo itong balewalain.',
  },

  offline: {
    title: 'Mag-aral offline',
    saved:
      '{count, plural, one {# tanong ang naka-save sa teleponong ito, hanggang {date}. Makakapagsanay ka at makakakuha ng mock exam kahit walang koneksyon.} other {# tanong ang naka-save sa teleponong ito, hanggang {date}. Makakapagsanay ka at makakakuha ng mock exam kahit walang koneksyon.}}',
    notSaved:
      'I-save ang bansang ito sa iyong telepono para makapagsanay at makakuha ng mock exam kahit walang koneksyon. Ipapadala ang mga sagot mo kapag online ka na ulit.',
    save: 'I-save para sa offline',
    update: 'I-update ang mga naka-save na tanong',
    bannerOfflineWaiting:
      '{count, plural, one {Offline ka. Ipapadala ang # naka-save na item kapag online ka na ulit.} other {Offline ka. Ipapadala ang # naka-save na item kapag online ka na ulit.}}',
    bannerOffline: 'Offline ka. Gumagana pa rin ang mga naka-save na bansa.',
    bannerSending:
      '{count, plural, one {Ipinapadala ang # naka-save na item…} other {Ipinapadala ang # naka-save na item…}}',
    bannerWaiting:
      '{count, plural, one {# naka-save na item ang naghihintay na maipadala.} other {# naka-save na item ang naghihintay na maipadala.}}',
    savingAudio: 'Sine-save ang audio: {done} sa {total}',
    audioSaved:
      '{count, plural, one {# recording ang naka-save para sa audio mode.} other {# recording ang naka-save para sa audio mode.}}',
    progressLater: 'Lalabas dito ang iyong progreso kapag online ka na ulit.',
    noConnection:
      'Walang koneksyon. I-download ang bansang ito habang online ka para makapag-aral kahit wala nito.',
  },

  profile: {
    title: 'Ang iyong profile',
    tabStudy: 'Pag-aaral',
    tabProfile: 'Profile',
    progress: 'Progreso',
    sessions: 'Mga sesyon',
    answered: 'Nasagutan',
    correct: 'Tama',
    dailyGoal: 'Layunin araw-araw: {count} minuto.',
    yourExams: 'Ang iyong mga pagsusulit',
    studyingIn: 'Nag-aaral sa {language}.',
    offline: 'Offline',
    noPacks:
      'Wala pang bansang naka-save sa teleponong ito. Mag-save ng isa mula sa tab na Pag-aaral para makapagsanay kahit walang koneksyon.',
    packLine:
      '{count, plural, one {{country}: # tanong, na-save noong {date}.} other {{country}: # tanong, na-save noong {date}.}}',
    removePack: 'Alisin sa teleponong ito',
    allSaved: 'Naka-save na sa iyong account ang lahat ng sinagot mo.',
    waiting:
      '{count, plural, one {# naka-save na item ang naghihintay na maipadala.} other {# naka-save na item ang naghihintay na maipadala.}}',
    lastTry: 'Huling subok: {problem}',
    sendNow: 'Ipadala ngayon',
    appLanguage: 'Wika ng app',
    appLanguageHint:
      'Ang wika ng mga button at menu. Ang wikang ginagamit mo sa pag-aaral ng mga tanong ay itinatakda para sa bawat pagsusulit.',
  },

  welcome: {
    countriesSoFar: '{count} bansa sa ngayon.',
    getStarted: 'Magsimula',
    unreachable: 'Hindi namin maabot ang Oathly. Suriin ang iyong koneksyon at subukan ulit.',
  },
};
