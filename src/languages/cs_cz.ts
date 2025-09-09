import CONST from '@src/CONST';
import Str from '@libs/common/str';
import type {
  CharacterLimitParams,
  TranslationBase,
  UntilTimeParams,
} from './types';
import type {
  CommonFriendsLabelParams,
  DiscardSessionParams,
  DrinkingSessionsParams,
  ForceUpdateTextParams,
  ForgotPasswordSuccessParams,
  FriendRequestsCountParams,
  NoDrinkingSessionsParams,
  SessionConfirmTimezoneChangeParams,
  SessionStartTimeParams,
  SessionWindowIdParams,
  SignUpNewAccountCodeParams,
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
} from './params';

/* eslint-disable max-len */
export default {
  common: {
    cancel: 'Zrušit',
    dismiss: 'Zavřít',
    yes: 'Ano',
    no: 'Ne',
    ok: 'OK',
    askMeLater: 'Zeptat se později',
    buttonConfirm: 'Rozumím',
    name: 'Jméno',
    attachment: 'Příloha',
    to: 'K',
    or: 'Nebo',
    optional: 'Volitelné',
    ago: 'Zpět',
    new: 'Nové',
    search: 'Hledat',
    searchWithThreeDots: 'Hledat...',
    next: 'Další',
    previous: 'Předchozí',
    goBack: 'Jít zpět',
    logIn: 'Přihlásit se',
    logInHere: 'Přihlaste se zde',
    signUp: 'Zaregistrovat se',
    signUpHere: 'Zaregistrujte se zde',
    create: 'Vytvořit',
    add: 'Přidat',
    resend: 'Odeslat znovu',
    save: 'Uložit',
    select: 'Vybrat',
    saveChanges: 'Uložit změny',
    submit: 'Odeslat',
    rotate: 'Otočit',
    zoom: 'Přiblížit',
    password: 'Heslo',
    magicCode: 'Magický kód',
    twoFactorCode: 'Dvoufaktorový kód',
    workspaces: 'Pracovní prostory',
    chats: 'Chaty',
    group: 'Skupina',
    profile: 'Profil',
    account: 'Účet',
    username: 'Uživatelské jméno',
    referral: 'Doporučení',
    payments: 'Platby',
    wallet: 'Peněženka',
    clear: 'Vymazat',
    preferences: 'Předvolby',
    view: 'Zobrazit',
    not: 'Ne',
    unknown: 'Neznámé',
    authentication: 'Ověření',
    signIn: 'Přihlásit se',
    signInWithGoogle: 'Přihlásit se přes Google',
    signInWithApple: 'Přihlásit se přes Apple',
    signInWith: 'Přihlásit se přes',
    continue: 'Pokračovat',
    firstName: 'Křestní jméno',
    lastName: 'Příjmení',
    displayName: 'Přezdívka',
    nickname: 'Přezdívka',
    phone: 'Telefon',
    phoneNumber: 'Telefonní číslo',
    phoneNumberPlaceholder: '(xxx) xxx-xxx-xxx',
    email: 'E-mail',
    and: 'a',
    details: 'Podrobnosti',
    privacy: 'Soukromí',
    hidden: 'Skryté',
    visible: 'Viditelné',
    delete: 'Smazat',
    discard: 'Zahodit',
    archived: 'archivováno',
    contacts: 'Kontakty',
    recents: 'Nedávné',
    close: 'Zavřít',
    loading: 'Načítání',
    download: 'Stáhnout',
    downloading: 'Stahování',
    warning: 'Varování',
    manage: 'Spravovat',
    pin: 'Připnout',
    unPin: 'Odepnout',
    back: 'Zpět',
    yesIKnowWhatIAmDoing: 'Ano, vím, co dělám',
    saveAndContinue: 'Uložit a pokračovat',
    settings: 'Nastavení',
    termsOfService: 'Podmínky služby',
    kirokuTermsOfService: 'Kiroku Podmínky služby',
    privacyPolicy: 'Zásady ochrany osobních údajů',
    members: 'Členové',
    invite: 'Pozvat',
    here: 'zde',
    date: 'Datum',
    dob: 'Datum narození',
    gender: 'Pohlaví',
    weight: 'Váha',
    currentYear: 'Aktuální rok',
    currentMonth: 'Aktuální měsíc',
    city: 'Město',
    state: 'Stát',
    streetAddress: 'Ulice a číslo',
    stateOrProvince: 'Stát / Provincie',
    country: 'Země',
    zip: 'PSČ',
    zipPostCode: 'PSČ',
    whatThis: 'Co to je?',
    iAcceptThe: 'Souhlasím s ',
    remove: 'Odstranit',
    admin: 'Administrátor',
    owner: 'Vlastník',
    dateFormat: 'YYYY-MM-DD',
    send: 'Odeslat',
    great: 'Skvělé!',
    notifications: 'Oznámení',
    na: 'N/A',
    noResultsFound: 'Žádné výsledky nebyly nalezeny',
    recentDestinations: 'Nedávné cíle',
    timePrefix: 'Teď je',
    time: 'Čas',
    units: 'Jednotky',
    drinks: 'Drink(y)',
    conjunctionFor: 'pro',
    todayAt: 'Dnes v',
    tomorrowAt: 'Zítra v',
    yesterdayAt: 'Včera v',
    success: 'Úspěch',
    copiedToClipboard: 'Zkopírováno do schránky',
    conjunctionAt: 'v',
    genericErrorMessage:
      'Ejhle... něco se pokazilo a váš požadavek se nepodařilo dokončit. Zkuste to prosím později.',
    error: {
      error: 'Chyba',
      unknown: 'Neznámá chyba',
      invalidAmount: 'Neplatná částka',
      acceptTerms: 'Musíte přijmout Podmínky služby, abyste mohli pokračovat',
      fieldRequired: 'Toto pole je povinné.',
      requestModified: 'Tento požadavek upravuje jiný člen.',
      characterLimit: ({limit}: CharacterLimitParams) =>
        `Překračuje maximální délku ${limit} znaků`,
      characterLimitExceedCounter: ({length, limit}) =>
        `Byl překročen limit znaků (${length}/${limit})`,
      dateInvalid: 'Vyberte prosím platné datum',
      invalidDateShouldBeFuture: 'Vyberte dnešek nebo budoucí datum.',
      invalidTimeShouldBeFuture:
        'Vyberte prosím čas alespoň o minutu pozdější.',
      invalidCharacter: 'Neplatný znak',
      enterAmount: 'Zadejte částku',
      enterDate: 'Zadejte datum',
      userNull:
        'Nepodařilo se najít vašeho uživatele. Prosím přihlaste se znovu.',
      notFound: 'Nenalezeno',
      reauthenticationFailed: 'Opětovné ověření selhalo',
      sessionIdCreation: 'Nepodařilo se vytvořit nové ID relace',
    },
    comma: 'čárka',
    semicolon: 'středník',
    please: 'Prosím',
    contactUs: 'kontaktujte nás',
    fixTheErrors: 'opravte chyby',
    inTheFormBeforeContinuing: 've formuláři před pokračováním',
    confirm: 'Potvrdit',
    reset: 'Obnovit',
    done: 'Hotovo',
    more: 'Více',
    join: 'Připojit se',
    leave: 'Odebrat se',
    decline: 'Odmítnout',
    cantFindAddress: 'Nemůžete najít vaši adresu? ',
    enterManually: 'Zadejte ručně',
    message: 'Zpráva ',
    leaveRoom: 'Opustit místnost',
    leaveThread: 'Opustit vlákno',
    you: 'Vy',
    youAfterPreposition: 'vám',
    your: 'váš',
    youAppearToBeOffline: 'Vypadá to, že jste offline.',
    thisFeatureRequiresInternet:
      'Tato funkce vyžaduje aktivní připojení k internetu.',
    areYouSure: 'Jste si jisti?',
    verify: 'Ověřit',
    yesContinue: 'Ano, pokračovat',
    websiteExample: 'např. https://www.kiroku.com',
    description: 'Popis',
    with: 's',
    shareCode: 'Sdílet kód',
    share: 'Sdílet',
    per: 'za',
    mi: 'míli',
    km: 'kilometr',
    copied: 'Zkopírováno!',
    someone: 'Někdo',
    total: 'Celkem',
    edit: 'Upravit',
    letsDoThis: 'Jdeme na to!',
    letsStart: 'Začít',
    showMore: 'Zobrazit více',
    category: 'Kategorie',
    tag: 'Štítek',
    receipt: 'Účtenka',
    replace: 'Nahradit',
    distance: 'Vzdálenost',
    mile: 'míle',
    miles: 'míle',
    kilometer: 'kilometr',
    kilometers: 'kilometry',
    recent: 'Nedávné',
    all: 'Vše',
    am: 'AM',
    pm: 'PM',
    tbd: 'Bude upřesněno',
    card: 'Karta',
    whyDoWeAskForThis: 'Proč to požadujeme?',
    required: 'Povinné',
    showing: 'Zobrazeno',
    of: 'z',
    default: 'Výchozí',
    update: 'Aktualizovat',
    member: 'Člen',
    role: 'Role',
    note: 'Poznámka',
    blackout: 'Výpadek paměti',
    timezone: 'Časové pásmo',
  },
  calendar: {
    monthNames: [
      'Leden',
      'Únor',
      'Březen',
      'Duben',
      'Květen',
      'Červen',
      'Červenec',
      'Srpen',
      'Září',
      'Říjen',
      'Listopad',
      'Prosinec',
    ],
    monthNamesShort: [
      'Led',
      'Úno',
      'Bře',
      'Dub',
      'Kvě',
      'Čvn',
      'Čvc',
      'Srp',
      'Zář',
      'Říj',
      'Lis',
      'Pro',
    ],
    dayNames: [
      'Neděle',
      'Pondělí',
      'Úterý',
      'Středa',
      'Čtvrtek',
      'Pátek',
      'Sobota',
    ],
    dayNamesShort: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
    today: 'Dnes',
  },
  textInput: {
    accessibilityLabel: 'Textové pole',
    resetSearch: 'Resetovat hledání',
  },
  bottomTabBar: {
    home: 'Domů',
    friends: 'Přátelé',
    profile: 'Profil',
    settings: 'Nastavení',
    achievements: 'Odznaky',
    statistics: 'Statistiky',
    menu: 'Menu',
  },
  drinks: {
    // The keys are in snake_case to match the API
    smallBeer: 'Malé pivo',
    beer: 'Pivo',
    wine: 'Víno',
    weakShot: 'Malý panák',
    strongShot: 'Velký panák',
    cocktail: 'Koktejl',
    other: 'Ostatní',
  },
  charts: {
    target: 'Cíl',
    heatmap: 'Heatmapa',
    trend: 'Trend',
    legend: 'Legenda',
    noData: 'Žádná data k dispozici',
    units: 'jednotky',
  },
  units: {
    yellow: 'Žlutá',
    orange: 'Oranžová',
  },
  timePeriods: {
    never: 'Nikdy',
    thirtyMinutes: '30 minut',
    oneHour: '1 hodina',
    afterToday: 'Dnes',
    afterWeek: 'Týden',
    custom: 'Vlastní',
    untilTomorrow: 'Do zítřka',
    untilTime: ({time}: UntilTimeParams) => `Do ${time}`,
    fullSingle: {
      second: 'sekunda',
      minute: 'minuta',
      hour: 'hodina',
      day: 'den',
      week: 'týden',
      month: 'měsíc',
      year: 'rok',
    },
    fullPlural: {
      second: 'sekund',
      minute: 'minut',
      hour: 'hodin',
      day: 'dnů',
      week: 'týdnů',
      month: 'měsíců',
      year: 'let',
    },
    abbreviated: {
      second: 's',
      minute: 'm',
      hour: 'h',
      day: 'd',
      week: 't',
      month: 'M',
      year: 'R',
    },
  },
  session: {
    people: {
      selectAll: 'Vybrat vše',
    },
    offlineMessageRetry:
      'Vypadá to, že jste offline. Zkontrolujte prosím připojení a zkuste to znovu.',
  },
  agreeToTerms: {
    title: 'Aktualizovali jsme naše podmínky služby',
    description:
      'Doporučujeme vám, abyste si pozorně přečetli aktualizované podmínky služby a zásady ochrany osobních údajů.',
    iHaveRead:
      'Přečetl(a) jsem si a souhlasím s podmínkami služby a zásadami ochrany osobních údajů',
    mustAgree:
      'Než budete pokračovat, musíte souhlasit s podmínkami služby a zásadami ochrany osobních údajů.',
  },
  location: {
    useCurrent: 'Použít aktuální polohu',
    notFound:
      'Nepodařilo se nám zjistit vaši polohu, zkuste to prosím znovu nebo zadejte adresu ručně.',
    permissionDenied:
      'Vypadá to, že jste zamítli oprávnění k přístupu k poloze.',
    please: 'Prosím',
    allowPermission: 'povolte přístup k poloze v nastavení',
    tryAgain: 'a poté to zkuste znovu.',
  },
  imageUpload: {
    uploadSuccess: 'Obrázek byl úspěšně nahrán!',
    uploadingImage: 'Nahrávání obrázku...',
    uploadFinished: 'Nahrávání dokončeno!',
    pleaseReload: 'Znovu načtěte aplikaci, abyste viděli změny.',
  },
  storage: {
    permissionDenied: 'Je vyžadováno oprávnění k úložišti',
    appNeedsAccess:
      'Aplikace potřebuje přístup k vašemu úložišti pro čtení souborů. Přejděte prosím do nastavení aplikace a udělte oprávnění.',
    openSettings: 'Otevřít nastavení',
  },
  permissions: {
    permissionDenied: 'Přístup zamítnut',
    youNeedToGrantPermission:
      'Pro fungování této funkce musíte udělit oprávnění.',
    camera: {
      title: 'Je vyžadován přístup k fotoaparátu',
      message: 'Tato aplikace potřebuje přístup k vaší kameře pro focení.',
    },
    read_photos: {
      title: 'Je vyžadován přístup k fotografiím',
      message: 'Tato aplikace potřebuje přístup k vašim fotografiím.',
    },
    write_photos: {
      title: 'Je vyžadován přístup k úpravě fotografií',
      message: 'Tato aplikace potřebuje oprávnění k ukládání fotografií.',
    },
    notifications: {
      title: 'Je vyžadován přístup k oznámením',
      message:
        'Tato aplikace potřebuje přístup k odesílání oznámení do vašeho zařízení.',
    },
  },
  personalDetails: {
    error: {
      hasInvalidCharacter: 'Neplatný znak',
      containsReservedWord: 'Toto jméno obsahuje vyhrazené slovo.',
      characterLimitExceedCounter: ({length, limit}) =>
        `Byl překročen limit znaků (${length}/${limit})`,
      characterLimit: ({limit}: CharacterLimitParams) =>
        `Překračuje maximální délku ${limit} znaků`,
      requiredFirstName: 'Křestní jméno nesmí být prázdné',
      requiredLastName: 'Příjmení nesmí být prázdné',
      requiredDisplayName: 'Přezdívka nesmí být prázdná',
    },
  },
  searchResult: {
    self: 'To jsem já',
    friend: 'Přítel',
    sent: 'Žádost odeslána',
    accept: 'Přijmout',
    add: 'Poslat žádost',
  },
  socialScreen: {
    title: 'Přátelé',
    friendList: 'Seznam přátel',
    friendSearch: 'Vyhledat přátele',
    friendRequests: 'Žádosti o přátelství',
    noFriendsYet: 'Zatím nemáte žádné přátele',
    addThemHere: 'Přidejte si je zde',
  },
  friendsFriendsScreen: {
    title: 'Najít přátele přátel',
    seeProfile: 'Zobrazit profil',
    searchUsersFriends: 'Hledat přátele uživatele',
    commonFriends: 'Společní přátelé',
    otherFriends: 'Ostatní přátelé',
    noFriendsFound: 'Nebyli nalezeni žádní přátelé.',
    trySearching: 'Zkuste vyhledat jiné uživatele.',
    hasNoFriends: 'Tento uživatel ještě nepřidal žádné přátele.',
  },
  friendSearchScreen: {
    title: 'Vyhledat nové přátele',
    noUsersFound: 'Neexistují žádní uživatelé s touto přezdívkou.',
    searchWindow: 'Vyhledejte uživatele podle jejich přezdívky',
  },
  friendRequestScreen: {
    requestsReceived: ({requestsCount}: FriendRequestsCountParams) =>
      `Přijaté žádosti (${requestsCount})`,
    requestsSent: ({requestsCount}: FriendRequestsCountParams) =>
      `Odeslané žádosti (${requestsCount})`,
    lookingForNewFriends: 'Hledáte nové přátele?',
    trySearchingHere: 'Zkuste hledat zde',
    accept: 'Přijmout',
    remove: 'Odstranit',
    error: {
      userDoesNotExist: 'Tento uživatel neexistuje.',
      couldNotAccept: 'Nepodařilo se přijmout žádost o přátelství.',
      couldNotRemove: 'Nepodařilo se odstranit žádost o přátelství.',
    },
  },
  friendListScreen: {
    searchYourFriendList: 'Prohledat seznam přátel',
    userList: 'List vašich přátel',
  },
  notFoundScreen: {
    title: 'Nenalezeno',
  },
  preferencesScreen: {
    title: 'Předvolby',
    generalSection: {
      title: 'Obecné',
      firstDayOfWeek: 'První den v týdnu',
      theme: 'Motiv aplikace',
    },
    drinksAndUnitsSection: {
      title: 'Drinky a jednotky',
      description:
        'Nastavte přepočet drinků na jednotky a kdy se mění barva relace',
      drinksToUnits: 'Drinky na jednotky',
      unitsToColors: 'Jednotky na barvy',
    },
    save: 'Uložit předvolby',
    saving: 'Ukládání vašich předvoleb...',
    unsavedChanges: 'Máte neuložené změny. Opravdu se chcete vrátit zpět?',
    error: {
      save: 'Nepodařilo se uložit vaše předvolby. Zkuste to prosím znovu.',
    },
  },
  unitsToColorsScreen: {
    title: 'Jednotky na barvy',
    description:
      'Nastavte hraniční body, při kterých se mění barvy relace; tyto body představují maximální hodnotu, do které zůstane relace v dané barvě',
  },
  drinksToUnitsScreen: {
    title: 'Drinky na jednotky',
    description: 'Zvolte, kolika jednotkám je roven každý z drinků',
  },
  languageScreen: {
    language: 'Jazyk',
    languages: {
      en: {
        label: 'Angličtina',
      },
      cs_cz: {
        label: 'Čeština',
      },
    },
  },
  themeScreen: {
    theme: 'Motiv',
    themes: {
      dark: {
        label: 'Tmavý',
      },
      light: {
        label: 'Světlý',
      },
      system: {
        label: 'Systémový',
      },
    },
    loading: 'Nastavuji motiv. Prosím čekejte...',
    chooseThemeBelowOrSync:
      'Vyberte motiv níže, nebo jej synchronizujte s nastavením vašeho zařízení.',
  },
  adminScreen: {
    title: 'Nástroje pro administrátory',
    generalSection: 'Obecné',
    seeFeedback: 'Zobrazit zpětnou vazbu',
    seeBugReports: 'Zobrazit hlášení chyb',
    feedback: 'Zpětná vazba',
    bugReports: 'Hlášení chyb',
  },
  sessionSummaryScreen: {
    title: 'Souhrn relace',
    generalSection: {
      title: 'Obecné',
      sessionColor: 'Barva relace',
      units: 'Jednotky',
      date: 'Datum',
      type: 'Typ relace',
      startTime: 'Čas zahájení',
      lastDrinkAdded: 'Poslední přidaný drink',
      endTime: 'Čas ukončení',
    },
    drinksSection: {
      title: 'Zkonzumované drinky',
    },
    otherSection: {
      title: 'Ostatní',
    },
  },
  appShareScreen: {
    title: 'Sdílet aplikaci',
    sectionTitle: 'Všichni sem!',
    prompt:
      'Pomozte nám růst tím, že budete Kiroku sdílet se svými přáteli! Můžete tak učinit pomocí odkazu nebo naskenováním QR kódu.',
    link: 'Zkopírovat odkaz ke sdílení do schránky',
    linkCopied: 'Odkaz ke sdílení byl zkopírován do schránky!',
    qrCode: 'Zobrazit QR kód',
    error: {
      copy: 'Chyba při kopírování do schránky. Zkuste to prosím znovu.',
    },
  },
  settingsScreen: {
    title: 'Nastavení',
    deleteAccount: 'Smazat účet',
    improvementThoughts: 'Co byste chtěli zlepšit?',
    general: 'Obecné',
    reportBug: 'Nahlásit chybu',
    giveFeedback: 'Zpětná vazba',
    signOut: 'Odhlásit se',
    shareTheApp: 'Sdílet aplikaci',
    adminTools: 'Nástroje pro administrátory',
    about: 'O aplikaci',
    signOutConfirmationText: 'Opravdu se chcete odhlásit?',
    signingOut: 'Odhlašuji...',
    aboutScreen: {
      viewTheCode: 'Zobrazit zdrojový kód',
      aboutKiroku: 'O Kiroku',
      description:
        'Kiroku je mobilní aplikace, která vám pomáhá sledovat konzumaci alkoholu.',
      joinDiscord: 'Připojte se na náš Discord',
      versionLetter: 'v',
      readTheTermsAndPrivacy: {
        phrase1: 'Přečtěte si',
        phrase2: 'Podmínky služby',
        phrase3: 'a',
        phrase4: 'Zásady ochrany osobních údajů',
      },
    },
    termsOfServiceScreen: {
      loading: 'Načítám Podmínky služby...',
    },
    privacyPolicyScreen: {
      loading: 'Načítám Zásady ochrany osobních údajů...',
    },
    error: {},
  },
  accountScreen: {
    title: 'Detaily profilu',
    generalOptions: {
      title: 'Obecné',
    },
    personalDetails: {
      title: 'Osobní údaje',
      subtitle:
        'Tyto údaje nám pomáhají poskytovat vám co nejlepší uživatelský zážitek.',
    },
  },
  drinkingSession: {
    type: {
      live: 'Živá',
      edit: 'Zpětná',
    },
    live: {
      title: 'Živá',
      description: 'Přidávejte drinky v reálném čase',
    },
    edit: {
      title: 'Zpětná',
      description: 'Zaznamenejte své minulé relace',
    },
    error: {
      sessionOpen: 'Nepodařilo se otevřít relaci',
      missingId: 'Chybí ID relace',
      missingData: 'Chybí data relace',
    },
  },
  startSession: {
    ongoingSessions: 'Probíhající relace',
    startNewSession: 'Spustit novou relaci',
    newSession: 'Spustit relaci',
    newSessionExplained: 'Spustit relaci (plovoucí tlačítko)',
    sessionFrom: ({startTime}: SessionStartTimeParams) =>
      `Relace od ${startTime}`,
  },
  userNameScreen: {
    headerTitle: 'Uživatelské jméno',
    explanation:
      'Zobrazení vašeho jména pomáhá vašim přátelům snadno vás najít a poznat na vašem profilu.',
    note: 'Poznámka: Vaše jméno se zatím jinde v aplikaci nezobrazuje. Pracujeme na tom!',
    updatingUserName: 'Aktualizujeme vaše jméno...',
  },
  displayNameScreen: {
    headerTitle: 'Přezdívka',
    isShownOnProfile: 'Vaše přezdívka se zobrazuje na vašem profilu.',
    updatingDisplayName: 'Aktualizujeme vaši přezdívku...',
  },
  tzFix: {
    introduction: {
      title: 'Důležité!',
      text1:
        'Ahoj! Chceme vás informovat o důležité aktualizaci týkající se toho, jak vaše data v naší aplikaci zpracováváme.',
      troubleWithTimezones: 'Problémy s časovými pásmy',
      text2:
        'Doposud shromažďovaná data neobsahovala informace o časovém pásmu, což může ovlivňovat přesnost a konzistenci vašich dat v různých regionech.',
      whatDoesThisMean: 'Co to znamená?',
      text3:
        'Abychom zlepšili váš uživatelský zážitek a zajistili přesné časové údaje, potřebujeme do všech vašich stávajících relací přidat časové pásmo. V následujících krocích zjistíme vaše aktuální časové pásmo a požádáme vás o svolení k synchronizaci.',
      confirmButtonText: 'Dobře, rozumím!',
    },
    detection: {
      title: 'Začněme!',
      isTimezoneCorrect:
        'Automaticky jsme zjistili, že vaše časové pásmo je následující. Je to správně?',
      correct: 'Ano, to je správné',
      incorrect: 'Ne, mé obvyklé časové pásmo je jiné',
    },
    confirmation: {
      title: 'Připraveni synchronizovat?',
      text: 'Chcete pokračovat v synchronizaci všech vašich stávajících dat do UTC pomocí vámi zvoleného časového pásma?',
      cancelPrompt:
        'Pokud data nesynchronizujete, mohou se zobrazovat nesprávné časy.',
      cancel: 'Udělám to později',
      resume: 'Rozmyslel(a) jsem si to, pojďme to udělat!',
      syncNow: 'Jasně, jdeme na to!',
      syncLater: 'Ne, teď ne',
      syncing: 'Synchronizuji vaše data...',
      error: {
        generic: 'Chyba při synchronizaci vašich dat',
      },
    },
    success: {
      title: 'Hotovo!',
      text1:
        'Vaše data byla úspěšně označena časovými razítky. Můžete pokračovat!',
      text2:
        'Pokud budete mít jakékoli dotazy nebo budete potřebovat pomoci ohledně této synchronizace, neváhejte se na nás obrátit na kiroku.alcohol.tracker@gmail.com.',
      finishButton: 'Skvělé!',
    },
  },
  timezoneScreen: {
    timezone: 'Časové pásmo',
    isShownOnProfile: 'Vaše časové pásmo je zobrazeno na vašem profilu.',
    getLocationAutomatically: 'Automaticky zjistit polohu',
    saving: 'Vaše časové pásmo se ukládá...',
  },
  emailScreen: {
    title: 'Aktualizovat e-mail',
    prompt:
      'Váš e-mail se používá k přihlášení a k zasílání důležitých oznámení.',
    note: 'Poznámka: Po potvrzení vám na novou adresu pošleme ověřovací e-mail. Pro dokončení změny ji budete muset ověřit a poté aplikaci restartovat, abyste viděli změny.',
    enterEmail: 'Zadejte svou e-mailovou adresu',
    submit: 'Aktualizovat e-mail',
    sent: 'E-mail byl úspěšně aktualizován!',
    sending: 'Aktualizujeme e-mail...',
    success: ({email}: UpdateEmailSentEmailParams) =>
      `E-mail s instrukcemi ke změně e-mailové adresy byl odeslán na ${email}. Po změně e-mailu prosím znovu načtěte aplikaci.`,
    enterPasswordToConfirm: 'Pro ověření vaší identity zadejte prosím heslo.',
    enterPassword: 'Zadejte heslo',
  },
  verifyEmailScreen: {
    youAreNotVerified: 'Ověřte svůj e-mail!',
    wouldYouLikeToVerify: ({email}: VerifyEmailScreenEmailParmas) =>
      `Chcete ověřit e-mail ${email ?? 'vaši adresu'} rovnou?`,
    illDoItLater: 'Udělám to později',
    verifyEmail: 'Ověřit e-mail',
    changeEmail: 'Změnit e-mail',
    resendEmail: 'Znovu odeslat e-mail',
    emailSent: 'Ověřovací e-mail byl odeslán na vaši adresu.',
    emailVerified: 'E-mail byl ověřen!',
    iHaveVerified: 'E-mail mám ověřený',
    oneMoreStep: 'Ještě jeden krok!',
    checkYourInbox:
      "Zkontrolujte svou e-mailovou schránku a ověřte svůj e-mail.\nPoté buď restartujte aplikaci, abyste viděli změny, nebo stiskněte tlačítko 'E-mail mám ověřený' níže.",
    error: {
      generic: 'Chyba při ověřování vašeho e-mailu',
      sending: 'Chyba při odesílání ověřovacího e-mailu',
      dismissing: 'Chyba při zrušení ověřovacího e-mailu',
      emailSentRecently:
        'Před odesláním dalšího ověřovacího e-mailu chvíli vyčkejte.',
      emailNotVerified: 'Váš e-mail stále nebyl ověřen.',
    },
  },
  reportBugScreen: {
    title: 'Nahlásit chybu',
    prompt: 'Co se stalo? Prosím podrobně popište vzniklou chybu níže.',
    describeBug: 'Popište chybu zde',
    submit: 'Odeslat hlášení',
    sent: 'Hlášení chyby bylo odesláno!',
    sending: 'Odesílám hlášení chyby...',
    error: 'Nastala chyba při odesílání hlášení. Zkuste to prosím znovu.',
  },
  feedbackScreen: {
    title: 'Zpětná vazba',
    prompt: 'Co byste chtěli, abychom zlepšili?',
    enterFeedback: 'Zadejte svou zpětnou vazbu zde',
    submit: 'Odeslat zpětnou vazbu',
    sent: 'Zpětná vazba odeslána!',
    sending: 'Odesílám zpětnou vazbu...',
    error: 'Došlo k chybě při odesílání zpětné vazby. Zkuste to prosím znovu.',
  },
  deleteAccountScreen: {
    deleteAccount: 'Smazat účet',
    reasonForLeavingPrompt:
      'Mrzí nás, že odcházíte! Mohli byste nám prosím sdělit proč, abychom se mohli zlepšit?',
    enterMessageHere: 'Zadejte zde svou zprávu',
    deleteAccountWarning: 'Smazání účtu nelze vrátit zpět.',
    deleteAccountPermanentlyDeleteData:
      'Opravdu chcete smazat svůj účet? Tím trvale odstraníte všechna svá data.',
    enterPasswordToConfirm: 'Zadejte prosím své heslo pro potvrzení.',
    enterPassword: 'Zadejte heslo',
    deletingAccount: 'Probíhá mazání vašeho účtu...',
  },
  profileScreen: {
    title: 'Profil',
    titleNotSelf: 'Přehled uživatele',
    noDrinkingSessions: ({isSelf}: NoDrinkingSessionsParams) =>
      `${isSelf ? 'Zatím jste' : 'Tento uživatel zatím'} nepřidal(a) žádné alkoholové relace.`,
    seeAllFriends: 'Zobrazit všechny přátele',
    drinkingSessions: ({sessionsCount}: DrinkingSessionsParams) =>
      `${Str.pluralize('Alkoholová Relace', 'Alkoholových Relací', sessionsCount)}`,
    unitsConsumed: ({unitCount}: UnitCountParams) =>
      `${Str.pluralize('Zkonzumovaná Jednotka', 'Zkomzumovaných Jednotek', unitCount)}`,
    manageFriend: 'Spravovat přítele',
    unfriendPrompt: 'Opravdu chcete tohoto uživatele odebrat z přátel?',
    unfriend: 'Odebrat z přátel',
    commonFriendsLabel: ({hasCommonFriends}: CommonFriendsLabelParams) =>
      `${hasCommonFriends ? 'Společní přátelé:' : 'Přátelé:'}`,
    profileImage: 'Profilový obrázek',
  },
  statisticsScreen: {
    title: 'Statistiky',
    comingSoon: 'Již brzy!',
  },
  achievementsScreen: {
    title: 'Odznaky',
    comingSoon: 'Již brzy!',
  },
  dayOverviewScreen: {
    enterEditMode: 'Režim úprav',
    exitEditMode: 'Ukončit úpravy',
    noDrinkingSessions: 'Žádné alkoholové relace',
    addSessionExplained: 'Přidat relaci (plovoucí tlačítko)',
    sessionWindow: ({sessionId}: SessionWindowIdParams) =>
      `Relace pití: ${sessionId}`,
    ongoing: 'Probíhá',
    loadingDate: 'Načítám datum...',
    error: {
      open: 'Nepodařilo se otevřít novou relaci. Zkuste to prosím znovu.',
    },
  },
  homeScreen: {
    startingSession: 'Spouštím novou relaci...',
    welcomeToKiroku: 'Vítejte v Kiroku!',
    startNewSessionByClickingPlus:
      'Spusťte novou relaci kliknutím na tlačítko plus v dolní části obrazovky',
    currentlyInSession: 'Právě se nacházíte v relaci!',
    currentlyInSessionButton:
      'Tlačítko, které informuje, že se právě nacházíte v relaci',
  },
  sessionsCalendar: {
    dayOverviewButton: 'Přehled dne',
  },
  liveSessionScreen: {
    saving: 'Ukládám vaši relaci...',
    synchronizing: 'Synchronizuji data...',
    loading: 'Načítám vaši relaci...',
    drinksConsumed: 'Zkonzumované drinky',
    sessionFrom: 'Relace od',
    sessionOn: 'Relace dne',
    blackout: 'Výpadek paměti',
    blackoutSwitchLabel: 'Označuje, zda vaše relace skončila výpadkem paměti.',
    note: 'Poznámka',
    discardSessionWarning: (discardWord: string) =>
      `Opravdu chcete tuto relaci ${discardWord}?`,
    unsavedChangesWarning: 'Máte neuložené změny. Opravdu chcete jít zpět?',
    sessionDetails: 'Podrobnosti o relaci',
    discardSession: ({discardWord}: DiscardSessionParams) =>
      `${discardWord} relaci`,
    saveSession: 'Uložit relaci',
    discardingSession: ({discardWord}: DiscardSessionParams) =>
      `${discardWord} tuto relaci...`,
  },
  sessionDateScreen: {
    title: 'Datum relace',
    prompt: 'Vyberte prosím datum, kdy jste tuto relaci zahájili.',
    error: {
      load: 'Nepodařilo se načíst podrobnosti této relace.',
      generic: 'Nepodařilo se upravit datum relace.',
    },
  },
  sessionNoteScreen: {
    title: 'Poznámka k relaci',
    noteDescription: 'Tato poznámka je soukromá a nebude sdílena s ostatními.',
    error: {
      load: 'Nepodařilo se načíst podrobnosti této relace.',
      generic: 'Nepodařilo se upravit poznámku k relaci.',
      noteTooLongError: 'Vaše poznámka je příliš dlouhá.',
    },
  },
  sessionTimezoneScreen: {
    title: 'Časové pásmo relace',
    description:
      'Vyberte časové pásmo, ve kterém jste se nacházeli při zahájení relace.',
    note: 'Poznámka: Pokaždé, když zobrazíte podrobnosti o této relaci, budou její časová razítka zobrazena v zvoleném časovém pásmu.',
    confirmPrompt: ({newTimezone}: SessionConfirmTimezoneChangeParams) =>
      `Nastavení časového pásma na ${newTimezone} změní datum této relace. Opravdu chcete pokračovat?`,
    error: {
      generic: 'Nepodařilo se upravit časové pásmo relace.',
      errorSelectTimezone:
        'Nepodařilo se vybrat časové pásmo. Zkuste to znovu.',
    },
  },
  maintenance: {
    heading: 'Probíhá údržba',
    text: 'V současné době probíhá údržba v následujícím časovém rozmezí:',
  },
  userOffline: {
    heading: 'Jste offline',
    text: 'Aplikace Kiroku zatím nepodporuje offline režim. Děkujeme vám za trpělivost při vývoji této funkce.',
  },
  userList: {
    noFriendsFound: 'Žádní přátelé nenalezeni.',
    tryModifyingSearch: 'Zkuste upravit vyhledávaný text.',
  },
  userOverview: {
    inSession: 'V relaci',
    from: 'Od',
    sober: 'Bez pití',
    sessionStarted: 'Relace zahájena',
    noSessionsYet: 'Zatím žádné relace',
  },
  yearPickerScreen: {
    year: 'Rok',
    selectYear: 'Vyberte prosím rok',
  },
  forceUpdate: {
    heading: 'Je vyžadována aktualizace aplikace',
    text: ({platform}: ForceUpdateTextParams) =>
      `Tato verze aplikace je nyní ukončena. Aktualizujte prosím na nejnovější verzi pomocí odkazu níže${
        platform === CONST.PLATFORM.IOS
          ? ' nebo z prostředí aplikace TestFlight'
          : ''
      }.`,
    link: 'Aktualizovat nyní',
  },
  welcomeText: {
    getStarted: 'Začněte níže',
    anotherLoginPageIsOpen: 'Další přihlašovací stránka je otevřená',
    anotherLoginPageIsOpenExplanation:
      'Přihlašovací stránku jste otevřeli v jiné záložce. Přihlaste se prosím z této záložky.',
    welcome: 'Vítejte!',
    welcomeWithoutExclamation: 'Vítejte',
    enterCredentials: 'Zadejte prosím své přihlašovací údaje.',
    welcomeNewAccount: ({login}: SignUpNewAccountCodeParams) =>
      `${login}!\nJste připraveni vytvořit si účet?`,
  },
  login: {
    hero: {
      header: 'Mějte přehled o svých alkoholových dobrodružstvích',
      body: 'Vítejte v Kiroku, kde můžete sledovat, monitorovat a sdílet svou konzumaci alkoholu',
    },
    email: 'E-mail',
    cannotGetAccountDetails:
      'Nelze načíst detaily účtu. Přihlaste se prosím znovu.',
    initialForm: 'Počáteční formulář',
    logInForm: 'Přihlašovací formulář',
    signUpForm: 'Registrační formulář',
    existingAccount: 'Už máte účet?',
    noAccount: 'Ještě nemáte účet?',
    error: {},
  },
  password: {
    changePassword: 'Změnit heslo',
    currentPassword: 'Aktuální heslo',
    newPassword: 'Nové heslo',
    reEnter: 'Zadejte heslo znovu',
    requirements:
      'Vaše heslo musí mít alespoň 8 znaků, 1 velké písmeno, 1 malé písmeno a 1 číslici.',
    pleaseFillOutAllFields: 'Vyplňte prosím všechna pole',
    pleaseFillPassword: 'Zadejte prosím své heslo',
    forgot: 'Zapomněli jste heslo?',
    changingPassword: 'Měním vaše heslo...',
    error: {
      samePassword: 'Toto heslo je stejné jako vaše aktuální',
      incorrectPassword: 'Nesprávné heslo. Zkuste to prosím znovu.',
      incorrectLoginOrPassword:
        'Nesprávné přihlašovací jméno nebo heslo. Zkuste to znovu.',
      invalidLoginOrPassword:
        'Neplatné přihlašovací jméno nebo heslo. Zkuste to znovu nebo resetujte heslo.',
      unableToResetPassword:
        'Nepodařilo se změnit vaše heslo. Pravděpodobně vypršela platnost odkazu z dřívějšího resetu hesla. Poslali jsme vám nový e-mail s odkazem pro reset. Zkontrolujte poštu (včetně spamu), měl by dorazit během několika minut.',
      accountLocked:
        'Váš účet byl uzamčen po příliš mnoha neúspěšných pokusech. Zkuste to znovu za 1 hodinu.',
      fallback: 'Něco se pokazilo. Zkuste to prosím později.',
      passwordsMustMatch: 'Zadaná hesla se neshodují.',
    },
  },
  baseUpdateAppModal: {
    updateApp: 'Aktualizovat aplikaci',
    updatePrompt:
      'Je dostupná nová verze této aplikace.\nChcete aktualizovat nyní?',
  },
  username: {
    error: {
      usernameRequired: 'Uživatelské jméno je povinné',
      usernameTooLong: 'Toto uživatelské jméno je příliš dlouhé',
      sameUsername: 'Toto je stejné uživatelské jméno jako vaše stávající',
    },
  },
  emailForm: {
    email: 'E-mail',
    error: {
      invalidEmail: 'Neplatná e-mailová adresa',
      sameEmail: 'Toto je stejná e-mailová adresa jako vaše stávající',
      emailTooLong: 'Tato e-mailová adresa je příliš dlouhá',
      emailRequired: 'E-mailová adresa je povinná',
      pleaseEnterEmail: 'Zadejte prosím e-mailovou adresu',
      generic: 'Při aktualizaci vaší e-mailové adresy došlo k chybě.',
    },
  },
  logInScreen: {
    loggingIn: 'Přihlašuji...',
  },
  signUpScreen: {
    signingIn: 'Přihlašuji...',
    chooseAnotherMethod: 'Zvolte jiný způsob přihlášení',
    error: {
      generic: 'Při vytváření účtu došlo k chybě. Zkuste to prosím znovu.',
    },
  },
  forgotPasswordScreen: {
    title: 'Zapomenuté heslo',
    prompt:
      'Pošleme vám instrukce, jak resetovat heslo, na tuto e-mailovou adresu:',
    sending: 'Odesílám e-mail...',
    submit: 'Resetovat heslo',
    enterEmail: 'Zadejte sem svůj e-mail',
    success: ({email}: ForgotPasswordSuccessParams) =>
      `E-mail s pokyny pro reset hesla byl odeslán na adresu ${email}.`,
    error: {
      generic: 'Při pokusu o reset hesla došlo k chybě.',
    },
  },
  passwordScreen: {
    title: 'Změnit heslo',
    prompt: 'Zadejte prosím své stávající heslo a poté nové heslo.',
    submit: 'Změnit heslo',
    success: 'Heslo bylo úspěšně změněno!',
    error: {
      generic: 'Při pokusu o změnu hesla došlo k chybě.',
    },
  },
  closeAccount: {
    successMessage: 'Váš účet byl úspěšně smazán.',
  },
  database: {
    loading: 'Načítám data...',
    error: {
      generic: 'Nepodařilo se připojit k databázi',
      userDoesNotExist: 'Uživatel v databázi neexistuje',
      saveData:
        'Nepodařilo se uložit vaše data do databáze. Zkuste to prosím znovu.',
    },
  },
  genericErrorScreen: {
    title: 'Ups, něco se pokazilo!',
    body: {
      helpTextMobile: 'Prosím zavřete a znovu otevřete aplikaci.',
      helpTextEmail: 'Pokud problém přetrvává, kontaktujte',
    },
    refresh: 'Obnovit',
  },
  errors: {
    storage: {
      objectNotFound: {
        title: 'Objekt nenalezen',
        message:
          'Požadovaný objekt nebyl nalezen. Zkontrolujte údaje a zkuste to znovu.',
      },
      unauthorized: {
        title: 'Neoprávněný přístup',
        message: 'Nemáte potřebná oprávnění k provedení této akce.',
      },
    },
    auth: {
      accountDeletionFailed: {
        title: 'Nepodařilo se smazat účet',
        message: 'Při mazání účtu došlo k problému. Zkuste to prosím později.',
      },
      missingEmail: {
        title: 'Chybějící e-mail',
        message: 'Zadejte prosím platnou e-mailovou adresu.',
      },
      invalidEmail: {
        title: 'Neplatný e-mail',
        message:
          'Zadaná e-mailová adresa není platná. Zkontrolujte ji a zkuste to znovu.',
      },
      verifyEmail: {
        title: 'Je vyžadováno ověření e-mailu',
        message: 'Nejprve ověřte svou e-mailovou adresu, než ji změníte.',
      },
      missingPassword: {
        title: 'Chybějící heslo',
        message: 'K pokračování je vyžadováno heslo. Zadejte prosím své heslo.',
      },
      invalidCredential: {
        title: 'Neplatné přihlašovací údaje',
        message:
          'Zadané údaje jsou nesprávné. Zkontrolujte je a zkuste to znovu.',
      },
      weakPassword: {
        title: 'Slabé heslo',
        message:
          'Vaše heslo musí mít alespoň 6 znaků. Zvolte prosím silnější heslo.',
      },
      emailAlreadyInUse: {
        title: 'E-mail se již používá',
        message: 'Tato e-mailová adresa je již spojena s jiným účtem.',
      },
      userNotFound: {
        title: 'Uživatel nenalezen',
        message:
          'Nepodařilo se najít žádného uživatele s uvedenými údaji. Zkuste se zaregistrovat nebo to zkuste znovu.',
      },
      wrongPassword: {
        title: 'Nesprávné heslo',
        message: 'Zadané heslo je nesprávné. Zkuste to znovu.',
      },
      networkRequestFailed: {
        title: 'Offline',
        message:
          'Vypadá to, že jste offline. Zkontrolujte své připojení k internetu a zkuste to znovu.',
      },
      requiresRecentLogin: {
        title: 'Relace vypršela',
        message: 'Z bezpečnostních důvodů se prosím přihlaste znovu.',
      },
      apiKeyNotValid: {
        title: 'Chyba konfigurace',
        message:
          'Aplikace není správně nakonfigurována. Kontaktujte prosím vývojáře.',
      },
      tooManyRequests: {
        title: 'Příliš mnoho požadavků',
        message:
          'Odeslali jste příliš mnoho požadavků. Počkejte chvíli a zkuste to znovu.',
      },
      signOutFailed: {
        title: 'Odhlášení se nezdařilo',
        message: 'Při odhlašování nastal problém. Zkuste to prosím znovu.',
      },
      userIsNull: {
        title: 'Uživatel nenalezen',
        message: 'Nepodařilo se identifikovat váš účet. Restartujte aplikaci.',
      },
    },
    database: {
      accountCreationLimitExceeded: {
        title: 'Překročen limit pro vytváření účtů',
        message:
          'Překročili jste limit pro vytváření účtů. Zkuste to znovu později.',
      },
      dataFetchFailed: {
        title: 'Nepodařilo se načíst data',
        message: 'Při načítání dat došlo k chybě. Zkuste to prosím později.',
      },
      outdatedAppVersion: {
        title: 'Zastaralá verze aplikace',
        message:
          'Vaše verze aplikace je zastaralá. Aktualizujte prosím na nejnovější verzi.',
      },
      searchFailed: {
        title: 'Nepodařilo se vyhledat',
        message: 'Nepodařilo se vyhledat v databázi. Zkuste to prosím znovu.',
      },
      userCreationFailed: {
        title: 'Nepodařilo se vytvořit uživatele',
        message:
          'Během vytváření účtu došlo k problému. Zkuste to prosím znovu.',
      },
    },
    homeScreen: {
      title: {
        title: 'Chyba domovské obrazovky',
        message: 'Nepodařilo se načíst domovskou obrazovku.',
      },
      noLiveSession: {
        title: 'Žádná živá relace',
        message: 'Právě nejste v žádné relaci.',
      },
    },
    imageUpload: {
      fetchFailed: {
        title: 'Nahrání obrázku selhalo',
        message: 'Nepodařilo se načíst obrázek. Zkuste to prosím znovu.',
      },
      uploadFailed: {
        title: 'Nahrání obrázku selhalo',
        message:
          'Při nahrávání vašeho obrázku došlo k chybě. Zkuste to prosím znovu.',
      },
      choiceFailed: {
        title: 'Výběr obrázku selhal',
        message:
          'Při výběru vašeho obrázku došlo k chybě. Zkuste to prosím znovu.',
      },
    },
    onyx: {
      generic: {
        title: 'Chyba databáze',
        message: 'Nepodařilo se připojit k lokální databázi',
      },
    },
    session: {
      discardFailed: {
        title: 'Chyba při zahazování relace',
        message: 'Nepodařilo se zahodit relaci. Zkuste to prosím znovu.',
      },
      loadFailed: {
        title: 'Chyba při načítání relace',
        message: 'Nepodařilo se načíst relaci. Zkuste to prosím znovu.',
      },
      saveFailed: {
        title: 'Chyba při ukládání relace',
        message: 'Nepodařilo se uložit relaci. Zkuste to prosím znovu.',
      },
      startFailed: {
        title: 'Chyba při spuštění relace',
        message: 'Nepodařilo se spustit novou relaci.',
      },
    },
    user: {
      bugSubmissionFailed: {
        title: 'Nepodařilo se odeslat hlášení chyby',
        message:
          'Při odesílání chyby došlo k problému. Zkuste to prosím znovu.',
      },
      couldNotUnfriend: {
        title: 'Nepodařilo se odebrat z přátel',
        message:
          'Při odebírání z přátel došlo k problému. Zkuste to prosím znovu.',
      },
      dataFetchFailed: {
        title: 'Nepodařilo se načíst data uživatele',
        message:
          'Nepodařilo se načíst uživatelská data. Zkuste znovu načíst stránku.',
      },
      feedbackRemovalFailed: {
        title: 'Nepodařilo se odstranit zpětnou vazbu',
        message:
          'Při odstraňování zpětné vazby došlo k problému. Zkuste to prosím znovu.',
      },
      feedbackSubmissionFailed: {
        title: 'Nepodařilo se odeslat zpětnou vazbu',
        message:
          'Při odesílání zpětné vazby došlo k problému. Zkuste to prosím znovu.',
      },
      friendRequestSendFailed: {
        title: 'Nepodařilo se odeslat žádost o přátelství',
        message:
          'Při odesílání žádosti došlo k problému. Zkuste to prosím znovu.',
      },
      friendRequestAcceptFailed: {
        title: 'Nepodařilo se přijmout žádost o přátelství',
        message:
          'Při přijímání žádosti došlo k problému. Zkuste to prosím znovu.',
      },
      friendRequestRejectFailed: {
        title: 'Nepodařilo se odstranit žádost o přátelství',
        message:
          'Při odstraňování žádosti došlo k problému. Zkuste to prosím znovu.',
      },
      nicknameUpdateFailed: {
        title: 'Nepodařilo se aktualizovat přezdívku',
        message:
          'Při aktualizaci přezdívky došlo k chybě. Zkuste to prosím znovu.',
      },
      statusUpdateFailed: {
        title: 'Nepodařilo se aktualizovat stav',
        message: 'Při aktualizaci stavu došlo k chybě. Zkuste to prosím znovu.',
      },
      themeUpdateFailed: {
        title: 'Nepodařilo se aktualizovat motiv',
        message:
          'Při aktualizaci motivu došlo k chybě. Zkuste to prosím znovu.',
      },
      timezoneUpdateFailed: {
        title: 'Nepodařilo se aktualizovat časové pásmo',
        message:
          'Při aktualizaci časového pásma došlo k chybě. Zkuste to prosím znovu.',
      },
      usernameUpdateFailed: {
        title: 'Nepodařilo se aktualizovat uživatelské jméno',
        message:
          'Při aktualizaci uživatelského jména došlo k chybě. Zkuste to prosím znovu.',
      },
    },
    generic: {
      title: 'Chyba',
      message: 'Došlo k chybě.',
    },
    permissionDenied: {
      title: 'Oprávnění zamítnuto',
      message: 'Nemáte potřebná oprávnění. Obraťte se prosím na správce.',
    },
    unknown: {
      title: 'Neznámá chyba',
      message: 'Došlo k neznámé chybě.',
    },
  },
} satisfies TranslationBase;
