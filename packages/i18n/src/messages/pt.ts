import type { Messages } from './en';

export const pt: Messages = {
  common: {
    signIn: 'Entrar',
    signOut: 'Sair',
    countries: 'Países',
    allCountries: 'Todos os países',
    pricing: 'Preços',
    faq: 'Perguntas',
    backToStudy: 'Voltar ao estudo',
    tryAgain: 'Tentar de novo',
    loading: 'Carregando',
    language: 'Idioma',
    mainNav: 'Principal',
    footerNav: 'Rodapé',
    breadcrumb: 'Caminho de navegação',
    comingSoon: 'Em breve',
    notAffiliated:
      'O Oathly é um aplicativo de estudo independente. Não é afiliado a nenhum governo nem endossado por nenhum.',
  },

  exam: {
    factSeparator: ', ',
    questionCount: '{count, plural, one {# pergunta} other {# perguntas}}',
    toPass: '{count} para passar',
    minutes: '{count, plural, one {# minuto} other {# minutos}}',
    noTimeLimit: 'sem limite de tempo',
    takenIn: 'Feito em {languages}',
    officialSource: 'Fonte oficial',
    checkedOn: 'verificado em {date}',
    detailsBeingChecked: 'dados em verificação',
    checkedQuestions:
      '{count, plural, one {# pergunta de prática verificada} other {# perguntas de prática verificadas}}',
    questionsBeingChecked: 'As perguntas de prática estão em verificação',
    studyFor: 'Estudar para {country}',
    countdownNone: 'Sem data de exame',
    countdownPassed: 'A data do exame já passou',
    countdownToday: 'O exame é hoje',
    countdownDays: '{count, plural, one {O exame é amanhã} other {Exame em # dias}}',
  },

  landing: {
    metaTitle: 'Oathly: prática para o teste de cidadania de cada país',
    metaDescription:
      'Pratique para o seu teste de cidadania com perguntas conferidas com fontes oficiais, respostas explicadas em linguagem simples e uma estimativa de quão preparado você está. Independente: sem afiliação a nenhum governo.',
    heroTitle: 'Chegue preparado ao seu teste de cidadania.',
    heroBody:
      'Perguntas de prática escritas a partir do guia oficial de cada país, respostas explicadas em linguagem simples e uma estimativa honesta de quão preparado você está.',
    startFree: 'Comece a estudar grátis',
    seeCountries: '{count, plural, one {Ver os países} other {Ver os # países}}',
    searchLabel: 'De qual país é o seu teste de cidadania?',
    searchNoMatch:
      'Ainda não há resultados para “{query}”. Adicionamos um país depois de conferir o exame com as fontes oficiais.',
    searchStatusNone: 'Nenhum país corresponde.',
    searchStatus:
      '{count, plural, one {# país corresponde. Pressione Tab para chegar a ele.} other {# países correspondem. Pressione Tab para chegar a eles.}}',

    howTitle: 'Como funciona',
    step1Title: 'Escolha seu país e seu exame',
    step1Body: 'Diga qual teste você vai fazer, quando e em que idioma quer estudar.',
    step2Title: 'Pratique um pouco todos os dias',
    step2Body:
      'Cada sessão mistura os temas mais difíceis para você, perguntas na hora de revisar e perguntas novas. As respostas erradas vêm com uma explicação e o trecho do guia oficial.',
    step3Title: 'Faça simulados quando estiver perto',
    step3Body:
      'Os simulados seguem o formato e a nota de aprovação reais. Sua pontuação de preparo mostra o quão perto você está e o que estudar em seguida.',

    countriesTitle: 'Países e exames',
    countriesIntro:
      'Adicionamos um país depois que o formato do exame e o material de estudo são conferidos com as fontes oficiais. Há mais a caminho.',
    countriesEmpty: 'A lista de países está sendo atualizada. Volte em instantes.',

    featuresTitle: 'Feito para o teste que você realmente vai fazer',
    featuresIntro:
      'A maioria dos aplicativos de cidadania cobre um único país com uma lista fixa de perguntas. O Oathly se baseia nas fontes oficiais e em como as pessoas realmente aprendem.',
    feature1Title: 'O teste de cada país, um só aplicativo',
    feature1Body:
      'Está se preparando para o teste de mais de um país? Estude para cada um na mesma conta, com o progresso separado.',
    feature2Title: 'Conferido com a fonte oficial',
    feature2Body:
      'Cada pergunta tem um link para a página do guia oficial de onde vem e mostra quando foi verificada pela última vez. Uma pessoa aprova cada uma antes de você vê-la.',
    feature3Title: 'Respostas explicadas',
    feature3Body:
      'Pergunte por que uma resposta está certa e receba uma explicação curta baseada no guia oficial, ou faça mais perguntas ao tutor.',
    feature4Title: 'Prática que se adapta a você',
    feature4Body:
      'As sessões focam nos seus temas mais fracos e trazem as perguntas de volta pouco antes de você esquecê-las.',
    feature5Title: 'Uma pontuação de preparo em que dá para confiar',
    feature5Body:
      'Uma estimativa ponderada como o exame real, que cai se você parar de estudar. Ela diz no que trabalhar, não só um número.',
    feature6Title: 'Estude no seu idioma',
    feature6Body:
      'Escolha entre {count} idiomas. As perguntas aparecem no idioma do exame enquanto uma tradução verificada não estiver pronta.',
    feature7Title: 'Grupos de estudo',
    feature7Body: 'Prepare-se ao lado de pessoas que vão fazer o mesmo teste.',
    feature8Title: 'Para escolas e organizações',
    feature8Body:
      'Turmas e serviços de acolhimento poderão acompanhar o desempenho de seus alunos.',

    pricingTitle: 'Preços',
    pricingIntro:
      'Estudar é grátis. Um plano pago vai acrescentar mais ajuda de IA para quem usa muito.',
    planFree: 'Grátis',
    planFreeNote: 'Sem cartão.',
    planFreeItem1: 'Prática, cartões e simulados ilimitados',
    planFreeItem2: 'Pontuação de preparo e sugestões de estudo',
    planAiAllowance: '{explanations} explicações e {messages} mensagens ao tutor por dia',
    planFreeItem4: 'Todos os países e idiomas de estudo',
    planPremium: 'Premium',
    planPremiumNote: 'Preço a ser anunciado.',
    planPremiumItem1: 'Tudo do plano Grátis',
    planGroups:
      'Escolas, bibliotecas e serviços de acolhimento: planos para grupos chegam em breve.',

    storiesTitle: 'O que dizem os alunos',
    storiesBody:
      'O Oathly é novo, então ainda não há avaliações. Quando quem estudou aqui tiver feito o teste, as palavras dessas pessoas aparecerão aqui. Só as reais, com permissão.',

    faqTitle: 'Perguntas',
    faq1Question: 'O Oathly é um aplicativo oficial do governo?',
    faq1Answer:
      'Não. O Oathly é independente e não é afiliado a nenhum governo nem endossado por nenhum. Para agendar seu teste ou conferir as regras que valem para você, use o site oficial do seu governo.',
    faq2Question: 'Estas são as perguntas reais do exame?',
    faq2Answer:
      'Alguns países publicam as perguntas exatas que fazem; outros publicam um guia de estudo e mantêm as perguntas em sigilo. De todo modo, cada pergunta do Oathly é escrita a partir do material oficial, tem um link para a página de onde vem e é verificada por uma pessoa antes de você vê-la.',
    faq3Question: 'A pontuação de preparo é precisa?',
    faq3Answer:
      'É uma estimativa, não uma previsão do seu resultado. Ela se baseia em quão bem você conhece cada tema, ponderado como o seu exame, e nos seus simulados recentes. Ela cai se você parar de estudar, porque a gente esquece.',
    faq4Question: 'Posso estudar no meu idioma?',
    faq4Answer:
      'Sim. Você pode escolher entre {count} idiomas. As traduções são verificadas antes de aparecer; até lá, você vê a pergunta no idioma do exame. O exame em si é feito no idioma definido pelo seu país.',
    faq5Question: 'Quanto custa?',
    faq5Answer:
      'A prática, os cartões, os simulados e a pontuação de preparo são grátis. Um plano pago com mais explicações de IA e mensagens ao tutor está a caminho; o preço ainda não foi definido.',
    faq6Question: 'Meu país não está na lista. Vocês vão adicioná-lo?',
    faq6Answer:
      'Estamos trabalhando para cobrir todos os países que têm teste de cidadania. Adicionamos cada um depois que o formato do exame e o material de estudo são conferidos com as fontes oficiais.',
  },

  countries: {
    indexMetaTitle: 'Testes de cidadania por país | Oathly',
    indexMetaDescription:
      'Os testes de cidadania para os quais o Oathly ajuda você a se preparar: formato, nota de aprovação, idiomas e temas, tudo conferido com a fonte oficial.',
    countryTitle: 'Teste de cidadania: {country}',
    countryMetaTitle: 'Teste de cidadania ({country}): formato, temas e prática | Oathly',
    countryMetaDescription:
      'Como é o teste de cidadania ({country}), o que ele cobre e perguntas de prática conferidas com o guia oficial.',
    countryLeadWithQuestions:
      '{count, plural, one {# pergunta de prática, conferida com o guia oficial.} other {# perguntas de prática, cada uma conferida com o guia oficial.}}',
    countryLeadNoQuestions: 'As perguntas de prática estão sendo conferidas com o guia oficial.',
    studyForTest: 'Estudar para o teste ({country})',
    theTest: 'O teste',
    formatBeingChecked: 'O formato do exame está em verificação.',
    whatItCovers: 'O que ele cobre',
    topicBeingChecked: 'Em verificação',
    topicsBeingAdded: 'Os temas estão sendo adicionados.',
    bookingNote:
      'Para agendar o teste ou conferir as regras que valem para você, use o site oficial indicado acima. O Oathly é um aplicativo de estudo independente e não é afiliado a nenhum governo.',
    topicMetaTitle: '{topic}: prática para o teste de cidadania ({country}) | Oathly',
    topicMetaDescription:
      'Perguntas de prática sobre {topic} para o teste de cidadania ({country}), cada uma conferida com o guia oficial.',
    topicLead: 'Perguntas de prática para o teste de cidadania ({country}).',
    topicEmpty:
      'As perguntas deste tema estão sendo conferidas com o guia oficial. Elas aparecem aqui depois que um revisor as aprova.',
    showAnswer: 'Mostrar a resposta',
    answerLabel: 'Resposta:',
    fromGuide: 'Do guia oficial: “{quote}”',
    source: 'Fonte',
    moreInApp:
      '{count, plural, one {Mais # pergunta de {topic}, com explicações e revisão espaçada, espera por você no Oathly.} other {Mais # perguntas de {topic}, com explicações e revisão espaçada, esperam por você no Oathly.}}',
    practiseInApp: 'Pratique com explicações, revisão espaçada e simulados no Oathly.',
    otherTopics: 'Outros temas',
  },

  auth: {
    metaTitle: 'Entrar | Oathly',
    title: 'Entre no Oathly',
    intro:
      'Primeira vez aqui? Ao entrar, sua conta é criada. Seu progresso fica salvo nela, então você pode continuar pelo celular ou em outro computador.',
    notConfigured: 'O acesso ainda não está configurado neste servidor.',
    email: 'E-mail',
    sendLink: 'Enviar um link de acesso',
    or: 'ou',
    google: 'Continuar com o Google',
    sentTitle: 'Confira seu e-mail',
    sentBody:
      'Enviamos um link de acesso para {email}. Ele funciona uma única vez e expira em breve. Você pode fechar esta aba.',
    differentEmail: 'Usar outro e-mail',
    sendFailed: 'Não conseguimos enviar o link. Tente de novo.',
    googleFailed: 'O acesso com o Google falhou. Tente de novo.',
    introMobile:
      'Primeira vez aqui? Ao entrar, sua conta é criada. Use o mesmo e-mail da web e seu progresso acompanha você.',
    emailRequired: 'Digite seu e-mail.',
    sendCode: 'Enviar um código',
    codeSent: 'Enviamos um código de seis dígitos para {email}. Ele expira em breve.',
    code: 'Código',
    verifyCode: 'Entrar',
    codeFailed: 'Esse código não funcionou. Confira e tente de novo.',
  },

  onboarding: {
    metaTitle: 'Configure seu estudo | Oathly',
    title: 'Configure seu estudo',
    titleAdd: 'Adicionar outro exame',
    intro: 'Quatro perguntas e você já pode começar. Dá para mudar tudo depois.',
    introAdd:
      'Você pode se preparar para vários testes de cidadania ao mesmo tempo. O progresso fica separado para cada um.',
    allCovered: 'Você já estuda para todos os exames que o Oathly cobre.',
    whichExam: 'Para qual exame você está se preparando?',
    searchCountries: 'Buscar países',
    countryCount: '{count, plural, one {# país} other {# países}}',
    countryCountFiltered: '{shown} de {total} países',
    inLanguages: 'em {languages}',
    noCountryMatch:
      'Nenhum país corresponde a “{query}”. O Oathly adiciona países à medida que verifica os exames.',
    countriesFailed:
      'Não conseguimos carregar a lista de países. Confira sua conexão e tente de novo.',
    examDate: 'Quando é o seu exame?',
    optional: '(opcional)',
    examDateHint: 'Usamos a data para definir o ritmo do seu plano de estudo.',
    examDateHintMobile:
      'Ano-mês-dia, por exemplo 2027-03-15. Usamos a data para definir o ritmo do seu plano de estudo.',
    studyLanguage: 'Em que idioma você quer estudar?',
    studyLanguageHint:
      'As perguntas aparecem neste idioma quando existe uma tradução verificada e, caso contrário, no idioma do exame.',
    dailyGoal: 'Quanto tempo você pode estudar por dia?',
    minutesShort: '{count} min',
    makePrimary: 'Abrir o aplicativo neste exame',
    start: 'Começar a estudar',
    add: 'Adicionar este exame',
    checkAnswers: 'Confira suas respostas.',
  },

  dashboard: {
    metaTitle: 'Estudar | Oathly',
    greeting: 'Olá, {name}',
    title: 'Seu estudo',
    todaysGoal: 'Meta de hoje',
    goalProgress: 'de {goal} minutos',
    goalProgressToday: 'de {goal} minutos hoje',
    streak: 'Sequência de estudo',
    streakDays: '{count, plural, one {dia seguido} other {dias seguidos}}',
    opensFirst: 'Abre primeiro',
    questionsReady:
      '{count, plural, one {# pergunta pronta para estudar.} other {# perguntas prontas para estudar.}}',
    questionsBeingChecked:
      'As perguntas de {country} ainda estão sendo conferidas com o guia oficial. Elas aparecem aqui depois que um revisor as verifica.',
    practise: 'Praticar',
    mockExam: 'Simulado',
    askTutor: 'Perguntar ao tutor sobre {country}',
    stopStudying: 'Parar de estudar para este exame',
    addExam: 'Adicionar outro exame',
    loadFailed: 'Não conseguimos carregar seu plano de estudo.',
    loadingPlan: 'Carregando seu plano de estudo',
  },

  readiness: {
    title: 'Preparo estimado',
    earlyEstimate: 'Estimativa inicial',
    earlyTitle: 'Estimativa inicial do seu preparo',
    meter: '{score}%, estimado',
    meterEarly: '{score}%, estimado, estimativa inicial',
    basedOn:
      '{count, plural, one {Com base em # pergunta até agora. Ela se estabiliza à medida que você pratica.} other {Com base em # perguntas até agora. Ela se estabiliza à medida que você pratica.}}',
    disclaimer:
      'Esta é uma estimativa a partir da sua prática e dos seus simulados, ponderada como o exame real. Não é garantia do seu resultado e cai se você parar de revisar.',
    topicKnowledge: 'Conhecimento dos temas',
    recentMocks: 'Simulados recentes',
    noMocks: 'Nenhum ainda',
    mockAverage: '{percent}% de acertos',
    studyNext: 'O que estudar em seguida',
    nothingStandsOut: 'Nada se destaca. Mantenha sua prática diária.',
    suggestStart: 'Comece a praticar',
    suggestStartDetail: 'Seu primeiro conjunto mistura perguntas de todos os temas.',
    suggestReview:
      '{count, plural, one {Revise # pergunta que você está prestes a esquecer} other {Revise # perguntas que você está prestes a esquecer}}',
    suggestReviewDetail: 'Responder agora, na hora certa, é o que faz elas ficarem.',
    suggestTopicDetail: 'Cerca de {share}% do exame, e você domina {mastery}% dele.',
    suggestMock: 'Faça um simulado',
    suggestMockDetail: '{exam}, cronometrado como o real.',
    start: 'Começar',
    byTopic: 'Por tema',
    shareOfExam: '({share}% do exame)',
  },

  start: {
    questionsFrom: 'Perguntas de',
    adaptive: 'Sob medida: temas fracos, revisões e novas',
    adaptiveDue: 'Sob medida: temas fracos, revisões e novas ({count} pendentes)',
    random: 'Todos os temas, ao acaso',
    howMany: 'Quantas',
    flashcards: 'Cartões',
    startMock: 'Começar simulado',
    practiceIntro: 'Dez perguntas escolhidas para você: temas fracos, revisões e novas.',
    practiceIntroDue:
      'Dez perguntas escolhidas para você: temas fracos, revisões ({count} pendentes) e novas.',
    oneTopic: 'Praticar um tema',
    hideTopics: 'Ocultar temas',
    topicWithMastery: '{topic} ({mastery}%)',
  },

  session: {
    metaTitle: 'Sessão de estudo | Oathly',
    practice: 'Prática',
    flashcards: 'Cartões',
    mockExam: 'Simulado',
    finishedTitle: 'Esta sessão terminou',
    finishedBody: 'Comece uma nova na sua página de estudo.',
    timeLeftMinutes:
      '{count, plural, one {Tempo restante: # minuto} other {Tempo restante: # minutos}}',
    timeLeft: 'Restam {time}',
    questionOf: 'Pergunta {current} de {total}',
    progress: 'Progresso',
    chooseOne: 'Escolha uma resposta',
    chooseAll: 'Escolha todas as respostas corretas',
    correct: 'Correto',
    notQuite: 'Não exatamente',
    check: 'Conferir',
    next: 'Próxima',
    submitExam: 'Entregar exame',
    nextQuestion: 'Próxima pergunta',
    seeResults: 'Ver resultados',
    keysChoose: 'Teclas: 1–{count} para escolher, Enter para confirmar',
    keysContinue: 'Teclas: Enter para continuar',
    answer: 'Resposta',
    answerInHead: 'Responda mentalmente e depois vire o cartão.',
    didNotKnow: 'Eu não sabia',
    knewIt: 'Eu sabia',
    showAnswer: 'Mostrar resposta',
    keysRate: 'Teclas: 1 ou 2',
    keysTurn: 'Tecla: Enter ou Espaço para virar',
    stillLearning: 'Ainda aprendendo',
    swipeHint:
      'Deslize o cartão para a direita se você sabia e para a esquerda se ainda está aprendendo.',
    tapToShow: 'Toque para ver a resposta',
    leave: 'Sair',
    yourAnswer: 'Sua resposta',
    correctAnswer: 'Resposta correta',
    fromGuide: 'Do guia oficial: “{quote}”',
    openFailedTitle: 'Não conseguimos abrir esta sessão',
    openFailedBody:
      'Ela pode ter sido iniciada em outro aparelho enquanto este celular estava sem conexão.',
    loadingSession: 'Carregando sua sessão',
    showInExamLanguage: 'Ver no idioma do exame ({language})',
    showInStudyLanguage: 'Ver no meu idioma de estudo ({language})',
    languageNote: 'O exame real é em {language}.',
  },

  results: {
    passed: 'Você passou',
    notPassed: 'Não foi desta vez',
    complete: 'Sessão concluída',
    stoppedPassed: 'Você atingiu a nota de aprovação, então o examinador pararia aqui.',
    stoppedFailed: 'Não é mais possível passar, então o examinador pararia aqui.',
    timeUp: 'O tempo acabou.',
    timedOut: 'O tempo acabou antes das últimas respostas.',
    correctOf: 'de {total} corretas.',
    knownOf: 'de {total} sabidas.',
    neededToPass: '{count} necessárias para passar.',
    sectionAllCorrect:
      'Todas as perguntas de “{section}” têm de estar certas; {correct} de {total} estavam.',
    byTopic: 'Por tema',
    topic: 'Tema',
    correctColumn: 'Corretas',
    scoreOf: '{correct} de {total}',
    nothingToReview: 'Nada para revisar',
    reviewCards: 'Cartões para rever',
    reviewWrong: 'Revise suas respostas erradas',
    youAnswered: 'Você respondeu: {answer}',
    nothing: 'nada',
    correctAnswer: 'Resposta correta: {answer}',
    source: 'fonte',
  },

  explain: {
    more: 'Explicar mais',
    writing: 'Escrevendo uma explicação…',
    aiNote:
      'Escrito por IA a partir do trecho do guia oficial. Não foi verificado por um revisor e pode conter erros.',
  },

  tutor: {
    metaTitle: 'Perguntar ao tutor | Oathly',
    title: 'Perguntar ao tutor',
    intro:
      'Perguntas sobre o teste de cidadania ({country}) e seu material de estudo. O tutor responde apenas com base no guia oficial e é uma IA: confira no guia tudo o que for importante. Ele não pode orientar sobre o seu próprio pedido.',
    you: 'Você:',
    tutor: 'Tutor:',
    questionLabel: 'Sua pergunta sobre o teste ({country})',
    ask: 'Perguntar',
    keys: 'Enter para enviar, Shift+Enter para uma nova linha.',
    remaining: '{count, plural, one {Resta # pergunta hoje.} other {Restam # perguntas hoje.}}',
    opening: 'Abrindo o tutor',
  },

  offline: {
    title: 'Estudar sem conexão',
    saved:
      '{count, plural, one {# pergunta salva neste celular, em {date}. Você pode praticar e fazer simulados sem conexão.} other {# perguntas salvas neste celular, em {date}. Você pode praticar e fazer simulados sem conexão.}}',
    notSaved:
      'Salve este país no seu celular para praticar e fazer simulados sem conexão. Suas respostas são enviadas quando você voltar a ficar online.',
    save: 'Salvar para usar sem conexão',
    update: 'Atualizar as perguntas salvas',
    bannerOfflineWaiting:
      '{count, plural, one {Você está sem conexão. # item salvo será enviado quando você voltar a ficar online.} other {Você está sem conexão. # itens salvos serão enviados quando você voltar a ficar online.}}',
    bannerOffline: 'Você está sem conexão. Os países salvos continuam funcionando.',
    bannerSending: '{count, plural, one {Enviando # item salvo…} other {Enviando # itens salvos…}}',
    bannerWaiting:
      '{count, plural, one {# item salvo aguardando envio.} other {# itens salvos aguardando envio.}}',
    progressLater: 'Seu progresso aparecerá aqui quando você voltar a ficar online.',
    noConnection: 'Sem conexão. Baixe este país enquanto estiver online para estudar sem ela.',
  },

  profile: {
    title: 'Seu perfil',
    tabStudy: 'Estudar',
    tabProfile: 'Perfil',
    progress: 'Progresso',
    sessions: 'Sessões',
    answered: 'Respondidas',
    correct: 'Corretas',
    dailyGoal: 'Meta diária: {count} minutos.',
    yourExams: 'Seus exames',
    studyingIn: 'Estudando em {language}.',
    offline: 'Sem conexão',
    noPacks:
      'Ainda não há países salvos neste celular. Salve um na aba Estudar para praticar sem conexão.',
    packLine:
      '{count, plural, one {{country}: # pergunta, salva em {date}.} other {{country}: # perguntas, salvas em {date}.}}',
    removePack: 'Remover deste celular',
    allSaved: 'Tudo o que você respondeu está salvo na sua conta.',
    waiting:
      '{count, plural, one {# item salvo está aguardando envio.} other {# itens salvos estão aguardando envio.}}',
    lastTry: 'Última tentativa: {problem}',
    sendNow: 'Enviar agora',
    appLanguage: 'Idioma do aplicativo',
    appLanguageHint:
      'O idioma dos botões e menus. O idioma em que você estuda as perguntas é definido para cada exame.',
  },

  welcome: {
    countriesSoFar: '{count} países até agora.',
    getStarted: 'Começar',
    unreachable: 'Não conseguimos conectar ao Oathly. Confira sua conexão e tente de novo.',
  },
};
