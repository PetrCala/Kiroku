import CONST from '@src/CONST';
import Str from '@libs/common/str';
import type {
  CharacterLimitParams,
  TranslationBase,
  UntilTimeParams,
} from './types';
import type {
  BadgesDayCountParams,
  BreakdownCenterUnitsParams,
  BreakdownDrinkLabelParams,
  BreakdownPeriodParams,
  BreakdownSliceCaptionParams,
  BreakdownTileSubtitleParams,
  CommonFriendsLabelParams,
  ConfirmWithProviderPromptParams,
  DiscardSessionParams,
  DrinkingSessionsParams,
  ForceUpdateTextParams,
  ForgotPasswordSuccessParams,
  FriendRequestsCountParams,
  LastSessionSummaryParams,
  OnboardingStepCounterParams,
  RelativeTimeAgoParams,
  SessionConfirmTimezoneChangeParams,
  SessionStartTimeParams,
  SessionWindowIdParams,
  StatsDrillDownTitleParams,
  StatsThresholdParams,
  SupporterCancelledStatusParams,
  SupporterPriceParams,
  SupporterPurchaseCtaParams,
  SupporterPurchaseErrorParams,
  SupporterRenewalDateParams,
  UnitCountParams,
  UpdateEmailSentEmailParams,
  VerifyEmailScreenEmailParmas,
  WeekOfParams,
} from './params';

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
    textInputField: 'Textové pole',
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
    google: 'Google',
    apple: 'Apple',
    signInWithGoogle: 'Přihlásit se přes Google',
    signInWithApple: 'Přihlásit se přes Apple',
    signInWith: 'Přihlásit se přes',
    continue: 'Pokračovat',
    createAccount: 'Vytvořit účet',
    getStarted: 'Začít',
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
    subscriptionTerms: 'Podmínky předplatného',
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
    drinks: 'Drinky',
    conjunctionFor: 'pro',
    todayAt: 'Dnes v',
    tomorrowAt: 'Zítra v',
    yesterdayAt: 'Včera v',
    success: 'Úspěch',
    copiedToClipboard: 'Zkopírováno do schránky',
    conjunctionAt: 'v',
    genericErrorMessage:
      'Ups… něco se pokazilo a váš požadavek se nepodařilo dokončit. Zkuste to prosím později.',
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
    websiteExample: 'např. https://www.kiroku.cz',
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
  modal: {
    backdropLabel: 'Zavřít',
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
    fullscreenTitle: 'Alkoholové relace',
    loadingOlderMonths: 'Načítání starších měsíců…',
    monthTotalUnits: ({unitCount}: UnitCountParams) =>
      `${unitCount} ${Str.pluralize('jednotka', 'jednotek', unitCount)}`,
    dayTotalUnits: ({unitCount}: UnitCountParams) =>
      `${unitCount} ${Str.pluralize('jednotka', 'jednotek', unitCount)}`,
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
    badges: 'Odznaky',
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
  units: {
    light: 'Mírná',
    moderate: 'Střední',
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
    uploadingImage: 'Nahrávání obrázku…',
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
    appNeedsAccess:
      'Kiroku potřebuje toto oprávnění. Otevřete nastavení aplikace a udělte přístup.',
    openSettings: 'Otevřít nastavení',
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
    location: {
      title: 'Je vyžadován přístup k poloze',
      message:
        'Kiroku může u drinků v živé relaci zaznamenat vaši aktuální polohu. Záznam probíhá pouze během otevřené živé relace a pokud máte tuto předvolbu zapnutou.',
    },
  },
  personalDetails: {
    error: {
      hasInvalidCharacter: 'Neplatný znak',
      containsReservedWord: 'Toto jméno obsahuje vyhrazené slovo.',
      containsProfanity:
        'Toto jméno obsahuje nevhodné výrazy. Zvolte prosím jiné.',
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
    blocked: 'Zablokováno',
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
    offlineNoData:
      'Jste offline. Nepodařilo se načíst vaše přátele. Připojte se a zobrazí se zde.',
  },
  friendAction: {
    error: {
      couldNotSendRequest:
        'Nepodařilo se odeslat žádost o přátelství. Zkuste to prosím znovu.',
      couldNotAcceptRequest:
        'Nepodařilo se přijmout žádost o přátelství. Zkuste to prosím znovu.',
      couldNotRemoveRequest:
        'Nepodařilo se odstranit žádost o přátelství. Zkuste to prosím znovu.',
      couldNotUnfriend:
        'Nepodařilo se odebrat tohoto přítele. Zkuste to prosím znovu.',
      couldNotBlockUser:
        'Nepodařilo se zablokovat tohoto uživatele. Zkuste to prosím znovu.',
    },
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
      colorPalette: 'Barevná paleta',
    },
    save: 'Uložit předvolby',
    saving: 'Ukládání vašich předvoleb…',
    unsavedChanges: 'Máte neuložené změny. Opravdu se chcete vrátit zpět?',
    error: {
      save: 'Nepodařilo se uložit vaše předvolby. Zkuste to prosím znovu.',
    },
  },
  locationPrompt: {
    title: 'Označovat, kde si zapisujete drinky?',
    prompt:
      'Kiroku může ke každému drinku zaznamenanému během živé relace připojit vaši aktuální polohu, takže se později můžete podívat, kde která relace proběhla. Toto nastavení můžete kdykoli změnit v Nastavení → Soukromí.',
    enable: 'Zapnout',
    notNow: 'Teď ne',
  },
  privacyScreen: {
    title: 'Soukromí',
    friendsVisibilitySection: {
      title: 'Přátelé',
    },
    hideFromAllFriends: {
      label: 'Skrýt má data před všemi přáteli',
      description:
        'Když je zapnuto, žádný přítel neuvidí vaše alkoholové relace.',
    },
    diagnosticsSection: {
      title: 'Diagnostika',
    },
    crashReporting: {
      label: 'Odesílat hlášení o pádech',
      description:
        'Odesílejte hlášení o pádech, abychom mohli rychleji opravovat chyby.',
    },
    communicationsSection: {
      title: 'Komunikace',
    },
    emailMarketing: {
      label: 'Novinky o aplikaci e-mailem',
      description:
        'Občas vám e-mailem pošleme novinky a tipy k aplikaci Kiroku. Kdykoli to můžete vypnout.',
    },
    locationSection: {
      title: 'Poloha',
    },
    trackLocationDuringSessions: {
      label: 'Označovat drinky polohou',
      description: 'Označte každý drink místem, kde jste ho zaznamenali.',
    },
    clearLocationHistory: {
      label: 'Vymazat historii polohy',
      description:
        'Smažte všechny uložené polohy. Vaše relace a drinky zůstanou.',
      button: 'Vymazat',
      confirmTitle: 'Vymazat historii polohy?',
      confirmPrompt:
        'Tímto trvale smažete všechny polohy připojené k drinkům ve všech vašich relacích. Samotné relace zůstanou zachovány. Označování polohou můžete kdykoli později znovu zapnout.',
      confirmAction: 'Vymazat',
      success: 'Vaše historie polohy byla vymazána.',
      error: 'Nepodařilo se vymazat historii polohy. Zkuste to prosím znovu.',
    },
    blockingSection: {
      title: 'Blokování',
    },
    blockedUsers: {
      label: 'Zablokovaní uživatelé',
      description: 'Zobrazte a spravujte lidi, které jste zablokovali.',
    },
    accountSection: {
      title: 'Účet',
    },
    manageAccount: {
      label: 'Správa účtu',
      description: 'Možnosti účtu, včetně smazání vašeho účtu.',
    },
    error: {
      save: 'Nepodařilo se uložit nastavení soukromí. Zkuste to prosím znovu.',
    },
  },
  blockedUsersScreen: {
    title: 'Zablokovaní uživatelé',
    unblockNote:
      'Odblokování nepřidá daného člověka zpět mezi přátele. Abyste byli znovu přáteli, musí jeden z vás poslat novou žádost o přátelství.',
    unblock: 'Odblokovat',
    unknownUser: 'Zablokovaný uživatel',
    emptyList: {
      title: 'Zatím jste nikoho nezablokovali',
      subtitle:
        'Když někoho zablokujete, objeví se zde, abyste ho mohli později odblokovat.',
    },
  },
  unitsToColorsScreen: {
    title: 'Jednotky na barvy',
    description:
      'Nastavte maximální počet jednotek pro mírnou a střední relaci. Cokoli nad tím už je náročná relace.',
  },
  colorPaletteScreen: {
    title: 'Barvy relací',
    description:
      'Vyberte si barevnou paletu pro ukazatele relací v kalendáři i na obrazovkách relací.',
    palettes: {
      classic: 'Klasická',
      sunset: 'Západ slunce',
      ocean: 'Oceán',
      mono: 'Monochromatická',
      colorblindSafe: 'Pro barvoslepé',
      brand: 'Značka',
      pink: 'Růžová',
    },
    descriptions: {
      classic: 'Jasné barvy semaforu',
      sunset: 'Teplé zemité tóny',
      ocean: 'Klidné modré a tyrkysové',
      mono: 'Pouze odstíny šedé',
      colorblindSafe: 'Rozlišitelné pro barvoslepé',
      brand: 'Značkové barvy Kiroku',
      pink: 'Růžová až po červenou',
    },
    useOwnPaletteForOthers: {
      label: 'Používat moji paletu pro všechny',
      description:
        'Relace přátel se zobrazí ve vybrané paletě místo v jejich vlastní.',
    },
    custom: {
      label: 'Vlastní',
      description: 'Vyberte si vlastní barvu pro každou úroveň relace.',
      createYourOwn: 'Vytvořte si vlastní',
      select: 'Použít vlastní paletu',
      edit: 'Upravit vlastní paletu',
    },
    editor: {
      title: 'Vlastní paleta',
      selectBand: 'Vyberte úroveň a poté zvolte její barvu.',
      save: 'Uložit paletu',
    },
    bands: {
      green: 'Žádné drinky',
      yellow: 'Mírná',
      orange: 'Střední',
      red: 'Náročná',
      black: 'Výpadek paměti',
    },
    hex: {
      label: 'Hex barva',
      placeholder: '#RRGGBB',
      invalid: 'Zadejte platnou hex barvu, například #1A2B3C.',
    },
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
    loading: 'Nastavuji motiv. Prosím čekejte…',
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
    giveFeedback: 'Poslat zpětnou vazbu',
    help: 'Nápověda a podpora',
    signOut: 'Odhlásit se',
    shareTheApp: 'Sdílet aplikaci',
    adminTools: 'Nástroje pro administrátory',
    about: 'O aplikaci',
    signOutConfirmationText: 'Opravdu se chcete odhlásit?',
    signingOut: 'Odhlašuji…',
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
      loading: 'Načítám Podmínky služby…',
    },
    privacyPolicyScreen: {
      loading: 'Načítám Zásady ochrany osobních údajů…',
    },
    subscriptionTermsScreen: {
      loading: 'Načítám Podmínky předplatného…',
    },
    helpScreen: {
      loading: 'Načítám podporu…',
    },
    error: {},
  },
  supporter: {
    tierName: 'Kiroku Supporter',
    badgeAccessibilityLabel: 'Kiroku Supporter',
    benefit: 'Odznak podporovatele na profilu',
    description:
      'Podpořte Kiroku a získejte odznak podporovatele 🍺 na svém profilu.',
    menuEntry: 'Podpořit Kiroku',
    paywallScreen: {
      title: 'Podpořit Kiroku',
      heroPill: 'Odznak podporovatele',
      heroTitle: 'Staňte se Kiroku Supporter',
      heroSubtitle:
        'Vyjádřete svou podporu a noste na profilu exkluzivní odznak podporovatele.',
      featureBadgeTitle: 'Odznak podporovatele',
      featureBadgeDescription:
        'Exkluzivní odznak zobrazený na vašem veřejném profilu',
      featureSupportTitle: 'Podpora vývoje',
      featureSupportDescription:
        'Pomozte udržet Kiroku zdarma a aktivně vyvíjené',
      featureEarlyAccessTitle: 'Předčasný přístup',
      featureEarlyAccessDescription:
        'Buďte první, kdo se dozví o nových funkcích a aktualizacích',
      planAnnualTitle: 'Roční',
      planMonthlyTitle: 'Měsíční',
      planMonthlyBilling: 'Účtováno měsíčně',
      bestValue: 'Nejlepší cena',
      pricePerYearShort: ({price}: SupporterPriceParams) => `${price} / rok`,
      pricePerMonthShort: ({price}: SupporterPriceParams) => `${price} / měs`,
      pricePerYear: ({price}: SupporterPriceParams) => `${price} / rok`,
      pricePerMonth: ({price}: SupporterPriceParams) => `${price} / měsíc`,
      startSupportingCta: ({price}: SupporterPriceParams) =>
        `Podpořit za ${price}`,
      loading: 'Načítám detaily předplatného…',
      thanksTitle: 'Jste Kiroku Supporter',
      thanksSubtitle:
        'Děkujeme za podporu. Odznak podporovatele je nyní viditelný na vašem profilu.',
      unavailableTitle: 'Předplatné není dostupné',
      unavailableSubtitle:
        'Nepodařilo se nám načíst předplatné podporovatele. Zkontrolujte připojení a zkuste to znovu.',
      purchaseCta: ({price}: SupporterPurchaseCtaParams) =>
        `Stát se podporovatelem za ${price} / měsíc`,
      purchaseError: ({message}: SupporterPurchaseErrorParams) =>
        `Nákup se nezdařil: ${message}. Zkuste to prosím znovu.`,
      restoreError: ({message}: SupporterPurchaseErrorParams) =>
        `Obnovení se nezdařilo: ${message}. Zkuste to prosím znovu.`,
      restorePurchases: 'Obnovit nákupy',
      restoreEmpty:
        'Na tomto účtu jsme nenašli žádné předchozí předplatné podporovatele. Pokud jste si jej pořídili na jiném zařízení, přihlaste se stejným účtem a zkuste to znovu.',
      autoRenewalNotice:
        'Předplatné se měsíčně automaticky obnovuje, dokud jej nezrušíte. Spravovat či zrušit jej můžete kdykoliv v App Store nebo Google Play, nejpozději 24 hodin před obnovením.',
      retry: 'Zkusit znovu',
      manageSubscriptionLink: 'Spravovat předplatné',
    },
    manageSubscription: {
      title: 'Správa předplatného',
      statusHeader: 'Stav předplatného',
      status: {
        active: 'Aktivní',
        cancelled: ({date}: SupporterCancelledStatusParams) =>
          `Zrušeno, aktivní do ${date}`,
        gracePeriod: 'Problém s platbou',
        expired: 'Vypršelo',
      },
      renewsOn: ({date}: SupporterRenewalDateParams) => `Obnoví se ${date}`,
      expiredOn: ({date}: SupporterRenewalDateParams) => `Vypršelo ${date}`,
      manageInAppStore: 'Spravovat v App Store',
      manageInGooglePlay: 'Spravovat v Google Play',
      restorePurchases: 'Obnovit nákupy',
      restoreSuccess: 'Nákupy obnoveny. Váš status podporovatele je aktivní.',
      restoreError: ({message}: SupporterPurchaseErrorParams) =>
        `Obnovení se nezdařilo: ${message}. Zkuste to prosím znovu.`,
      restoreEmpty:
        'Na tomto účtu nebylo nalezeno žádné aktivní předplatné podporovatele.',
      billingIssueCopy:
        'Vaši platbu se nepodařilo zpracovat. Aktualizujte způsob platby, abyste si zachovali status podporovatele.',
      expiredCopy:
        'Vaše předplatné podporovatele vypršelo. Předplatné si můžete obnovit na obrazovce Podpořit Kiroku.',
    },
  },
  premiumFeatures: {
    plusBadge: 'Plus',
    upsellAccessibilityLabel: 'Funkce Kiroku Plus. Klepnutím se dozvíte více.',
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
    unavailableTitle: 'Relace se nenačetly',
    unavailableMessage:
      'Nepodařilo se načíst vaše relace. Připojte se k internetu a zkuste to znovu.',
  },
  userNameScreen: {
    headerTitle: 'Uživatelské jméno',
    explanation:
      'Zobrazení vašeho jména pomáhá vašim přátelům snadno vás najít a poznat na vašem profilu.',
    note: 'Poznámka: Vaše jméno se zatím jinde v aplikaci nezobrazuje. Pracujeme na tom!',
    updatingUserName: 'Aktualizujeme vaše jméno…',
  },
  displayNameScreen: {
    headerTitle: 'Přezdívka',
    isShownOnProfile: 'Vaše přezdívka se zobrazuje na vašem profilu.',
    updatingDisplayName: 'Aktualizujeme vaši přezdívku…',
  },
  onboarding: {
    title: 'Onboarding',
    stepCounter: ({currentStep, totalSteps}: OnboardingStepCounterParams) =>
      `Krok ${currentStep} z ${totalSteps}`,
    terms: {
      heading: 'Přečtěte si prosím naše podmínky služby',
      description:
        'Před pokračováním si prosím přečtěte podmínky služby a zásady ochrany osobních údajů.',
    },
  },
  timezoneScreen: {
    timezone: 'Časové pásmo',
    isShownOnProfile: 'Vaše časové pásmo je zobrazeno na vašem profilu.',
    getLocationAutomatically: 'Automaticky zjistit polohu',
    saving: 'Vaše časové pásmo se ukládá…',
  },
  emailScreen: {
    title: 'Aktualizovat e-mail',
    prompt:
      'Váš e-mail se používá k přihlášení a k zasílání důležitých oznámení.',
    note: 'Poznámka: Po potvrzení vám na novou adresu pošleme ověřovací e-mail. Pro dokončení změny ji budete muset ověřit a poté aplikaci restartovat, abyste viděli změny.',
    enterEmail: 'Zadejte svou e-mailovou adresu',
    submit: 'Aktualizovat e-mail',
    sent: 'E-mail byl úspěšně aktualizován!',
    sending: 'Aktualizujeme e-mail…',
    success: ({email}: UpdateEmailSentEmailParams) =>
      `E-mail s instrukcemi ke změně e-mailové adresy byl odeslán na ${email}. Po změně e-mailu prosím znovu načtěte aplikaci.`,
    enterPasswordToConfirm: 'Pro ověření vaší identity zadejte prosím heslo.',
    enterPassword: 'Zadejte heslo',
  },
  verifyEmailScreen: {
    title: 'Ověřte svůj e-mail',
    body: ({email}: VerifyEmailScreenEmailParmas) =>
      `Poslali jsme ověřovací odkaz na adresu ${email ?? 'vaši adresu'}. Otevřete jej pro potvrzení a vraťte se zpět. Nevidíte ho? Podívejte se do složky spamu.`,
    resendEmail: 'Znovu odeslat e-mail',
    emailSent: 'Ověřovací e-mail byl odeslán.',
    emailVerified: 'E-mail byl ověřen!',
    iHaveVerified: 'E-mail mám ověřený',
    useADifferentEmail: 'Špatný e-mail? Použijte jiný',
    skipVerificationDevOnly: 'Přeskočit ověření (pouze pro vývoj)',
    changeEmail: {
      title: 'Použít jiný e-mail',
      prompt:
        'Zadejte novou adresu a heslo. Ověřovací odkaz vám pošleme na ni.',
      newEmailLabel: 'Nová e-mailová adresa',
      passwordLabel: 'Vaše heslo',
      submit: 'Odeslat ověřovací odkaz',
      sent: ({email}: VerifyEmailScreenEmailParmas) =>
        `Ověřovací odkaz byl odeslán na ${email}. Otevřete jej a pak klepněte na 'E-mail mám ověřený'.`,
      back: 'Zpět',
      error: {
        passwordRequired: 'Zadejte prosím heslo.',
      },
    },
    error: {
      generic: 'Chyba při ověřování vašeho e-mailu',
      sending: 'Chyba při odesílání ověřovacího e-mailu',
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
    sending: 'Odesílám hlášení chyby…',
    error: 'Nastala chyba při odesílání hlášení. Zkuste to prosím znovu.',
  },
  feedbackScreen: {
    title: 'Zpětná vazba',
    prompt: 'Co byste chtěli, abychom zlepšili?',
    enterFeedback: 'Zadejte svou zpětnou vazbu zde',
    submit: 'Odeslat zpětnou vazbu',
    sent: 'Zpětná vazba odeslána!',
    sending: 'Odesílám zpětnou vazbu…',
    error: 'Došlo k chybě při odesílání zpětné vazby. Zkuste to prosím znovu.',
  },
  accountSuspendedScreen: {
    title: 'Účet pozastaven',
    body: 'Váš účet byl pozastaven kvůli porušení našich pravidel komunity. Pokud si myslíte, že jde o omyl, kontaktujte podporu.',
    contactSupport: 'Kontaktovat podporu',
  },
  reportUserScreen: {
    title: 'Nahlásit',
    prompt:
      'Proč tohoto uživatele nahlašujete? Vaše hlášení je soukromé a bude předáno našemu moderátorskému týmu.',
    reasons: {
      inappropriateName: 'Nevhodné jméno',
      inappropriatePhoto: 'Nevhodná profilová fotografie',
      harassment: 'Obtěžování nebo šikana',
      other: 'Něco jiného',
    },
    descriptionLabel: 'Přidejte podrobnosti (volitelné)',
    alsoBlock: 'Také zablokovat tohoto uživatele',
    submit: 'Odeslat hlášení',
    successTitle: 'Hlášení přijato',
    successMessage:
      'Děkujeme za upozornění. Náš moderátorský tým tohoto uživatele prověří.',
  },
  manageAccountScreen: {
    title: 'Správa účtu',
    dangerZone: {
      title: 'Nebezpečná zóna',
      subtitle: 'Tyto akce jsou trvalé a nelze je vrátit zpět.',
    },
    deleteAccount: {
      title: 'Smazat účet',
    },
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
    deletingAccount: 'Probíhá mazání vašeho účtu…',
    confirmWithProviderPrompt: ({provider}: ConfirmWithProviderPromptParams) =>
      `Pro potvrzení smazání budete vyzváni k přihlášení pomocí ${provider}.`,
    error: {
      unsupportedProvider:
        'Váš způsob přihlášení není pro smazání účtu podporován. Kontaktujte prosím podporu.',
    },
  },
  profileScreen: {
    title: 'Profil',
    titleNotSelf: 'Přehled uživatele',
    seeAllFriends: 'Zobrazit všechny přátele',
    drinkingSessions: ({sessionsCount}: DrinkingSessionsParams) =>
      `${Str.pluralize('Alkoholová relace', 'Alkoholových relací', sessionsCount)}`,
    unitsConsumed: ({unitCount}: UnitCountParams) =>
      `${Str.pluralize('Zkonzumovaná jednotka', 'Zkonzumovaných jednotek', unitCount)}`,
    manageFriend: 'Spravovat přítele',
    report: 'Nahlásit',
    unfriendPrompt: 'Opravdu chcete tohoto uživatele odebrat z přátel?',
    unfriend: 'Odebrat z přátel',
    blockUser: 'Zablokovat uživatele',
    blockUserTitle: 'Zablokovat tohoto uživatele?',
    blockUserPrompt:
      'Zablokování zruší vaše přátelství a skryje vás navzájem. Daný uživatel vás nenajde ani vám nepošle žádost o přátelství. Později ho můžete odblokovat.',
    hideDataFromFriend: 'Skrýt má data před tímto přítelem',
    showDataToFriend: 'Zobrazit má data tomuto příteli',
    commonFriendsLabel: ({hasCommonFriends}: CommonFriendsLabelParams) =>
      `${hasCommonFriends ? 'Společní přátelé:' : 'Přátelé:'}`,
    profileImage: 'Profilový obrázek',
    offlineUnavailableTitle: 'Profil se nepodařilo načíst',
    offlineUnavailableMessage:
      'Tento profil se nepodařilo načíst v režimu offline. Pro zobrazení se znovu připojte.',
    privateTitle: 'Soukromý profil',
    privateMessage: 'Relace tohoto uživatele jsou soukromé.',
  },
  statistics: {
    title: 'Statistiky',
    period: {
      weekOf: ({date}: WeekOfParams) => `Týden od ${date}`,
    },
    tabs: {
      overview: {
        label: 'Přehled',
        hero: {
          label: 'Jednotky za období',
          unit: 'jednotek',
        },
        delta: {
          vsPrevious: 'vs předchozí',
        },
        sections: {
          highlights: 'Hlavní body',
          consumption: 'Konzumace',
          heavyDays: 'Náročné dny',
        },
        kpi: {
          afDays: {label: 'Dny bez alkoholu'},
          dryStreak: {label: 'Nejdelší série bez alkoholu', unit: 'dní'},
          sessions: {label: 'Relace'},
          heaviestDay: {label: 'Nejtěžší den', unit: 'jednotek'},
          avgPerDrinkingDay: {label: 'Průměr / den pití', unit: 'jednotek'},
          monthlyAvg: {label: 'Průměr / měsíc', unit: 'jednotek'},
          daysOverYellow: {
            label: ({threshold}: StatsThresholdParams) =>
              `Dny nad ${threshold}`,
          },
          daysOverOrange: {
            label: ({threshold}: StatsThresholdParams) =>
              `Dny nad ${threshold}`,
          },
          pctOver: {
            label: ({threshold}: StatsThresholdParams) =>
              `% dní nad ${threshold}`,
          },
        },
        texture: {
          series: {
            title: 'Jednotky podle období',
            a11y: 'Jednotky za dílčí období',
          },
          distribution: {
            title: 'Dny podle intenzity',
            a11y: 'Rozložení dní podle intenzity pití',
            af: 'Bez alk.',
            light: 'Mírná',
            moderate: 'Střední',
            heavy: 'Náročná',
          },
        },
        empty: {
          neverLogged: {
            title: 'Zatím není co zaznamenat',
            body: 'Až zaznamenáte relaci, objeví se zde váš přehled za období.',
          },
          noDataInRange:
            'Žádné relace v tomto období. Každý uplynulý den byl bez alkoholu.',
        },
        sparseFooter:
          'Zatím jen málo historie. Tato čísla se zpřesní, jak budete přidávat další záznamy.',
      },
      trends: {
        label: 'Trendy',
        weeklyTrend: {
          title: 'Týdenní jednotky',
          emptyLabel: 'Váš trend se ukáže, jak budou přibývat data.',
          legend: {
            perWeek: 'Za týden',
            trend: 'Trend',
          },
          captions: {
            trendingDown: 'Vaše týdenní jednotky mají sestupný trend.',
            trendingUp: 'Vaše týdenní jednotky mají vzestupný trend.',
            neutral: 'Vaše týdny se mění obvyklým způsobem.',
            notEnoughData:
              'Pokračujte v zaznamenávání. Trend se ukáže, až bude víc dat.',
          },
        },
        cumulativeAf: {
          title: 'Dny bez alkoholu v čase',
          emptyLabel: 'Každý den bez alkoholu se počítá.',
        },
        drinkTypeStack: {
          title: 'Mix drinků v čase',
          emptyLabel: 'Váš mix drinků se ukáže, jak budete přidávat data.',
        },
        comparison: {
          legend: 'Předchozí období',
        },
      },
      patterns: {
        label: 'Návyky',
        placeholder: 'Kdy a jak (hodina dne a den v týdnu) uvidíte tady.',
      },
      breakdown: {
        label: 'Rozpis',
        donut: {
          title: 'Jednotky podle druhu drinku',
          subtitle: 'Složení za aktuální období.',
          centerUnits: ({count}: BreakdownCenterUnitsParams) => `${count}`,
          centerCaption: 'jednotek',
          empty: 'Zatím není co rozdělit.',
          sliceCaption: ({label, units, share}: BreakdownSliceCaptionParams) =>
            `${label}: ${units} jednotek (${share} %)`,
          a11y: 'Koláč složení podle druhu drinku',
          current: 'Aktuální',
          previous: 'Předchozí',
        },
        multiples: {
          title: 'Týdenní trend podle druhu',
          subtitle: 'Malý graf pro každý druh s daty v tomto období.',
          empty: 'Zatím žádné trendy podle druhu. Zkuste širší období.',
          tileSubtitle: ({units}: BreakdownTileSubtitleParams) =>
            `${units} jednotek za období`,
          a11yTile: ({label}: BreakdownDrinkLabelParams) =>
            `Týdenní trend pro ${label}`,
        },
        concentration: {
          moreVaried: ({period}: BreakdownPeriodParams) =>
            `Tento ${period} jste pil/a pestřeji než minulý.`,
          moreFocused: ({period}: BreakdownPeriodParams) =>
            `Tento ${period} jste se zaměřil/a víc než minulý.`,
          aboutTheSame: ({period}: BreakdownPeriodParams) =>
            `Skladba drinků je zhruba stejná jako minulý ${period}.`,
          period: {
            week: 'týden',
            month: 'měsíc',
            sixMonths: '6 měsíců',
            year: 'rok',
            window: 'interval',
          },
        },
      },
    },
    legend: {
      drinkTypeA11y: 'Legenda druhů drinků',
    },
    charts: {
      weeklyBars: {
        title: 'Posledních 8 týdnů',
      },
      calendarHeatmap: {
        title: 'Tento měsíc',
      },
      hourOfDay: {
        title: 'Hodina dne',
        empty: 'Zatím není co zobrazit.',
      },
      dowHour: {
        title: 'Den v týdnu × hodina',
        empty: 'Zatím není co zobrazit.',
      },
      drinksPerSession: {
        title: 'Drinků na relaci',
        empty: 'Žádné relace k započtení.',
        p75Copy: ({value}: {value: number}) =>
          `75 % vašich relací má ${value} drinků nebo méně.`,
      },
      sessionDuration: {
        title: 'Délka relace',
        empty: 'Žádné relace k změření.',
        p75Copy: ({value}: {value: string}) =>
          `75 % vašich relací je kratších než ${value}.`,
      },
    },
    drilldown: {
      empty: 'V tomto výběru žádné relace.',
      close: 'Zavřít',
      title: {
        day: ({label}: StatsDrillDownTitleParams) => `Relace dne ${label}`,
        isoWeek: ({label}: StatsDrillDownTitleParams) => `Týden ${label}`,
        month: ({label}: StatsDrillDownTitleParams) =>
          `Relace v měsíci ${label}`,
        hour: ({label}: StatsDrillDownTitleParams) => `Relace kolem ${label}`,
        dow: ({label}: StatsDrillDownTitleParams) => `Relace: ${label}`,
        dowHour: ({label}: StatsDrillDownTitleParams) => label,
        drinkType: ({label}: StatsDrillDownTitleParams) => `Relace: ${label}`,
        isoWeekDrinkType: ({label}: StatsDrillDownTitleParams) => label,
        sessionDrinkCountBin: ({label}: StatsDrillDownTitleParams) =>
          `Relace s ${label}`,
        sessionDurationBin: ({label}: StatsDrillDownTitleParams) =>
          `Relace trvající ${label}`,
      },
    },
    filters: {
      range: {
        W: 'T',
        M: 'M',
        sixM: '6M',
        Y: 'R',
        all: 'Vše',
        custom: 'Vlastní',
      },
      drinkType: {
        all: 'Všechny drinky',
      },
      sessionType: {
        liveOnly: 'Jen živé relace',
      },
      comparison: {
        none: 'Porovnat',
        previousPeriod: 'vs minulé období',
        previousYear: 'vs minulý rok',
      },
      label: {
        thisWeek: 'Tento týden',
        thisMonth: 'Tento měsíc',
        thisYear: 'Tento rok',
        allTime: 'Celé období',
        jumpToLatest: 'Přejít na nejnovější',
      },
      customRange: {
        title: 'Vyberte rozsah dat',
        apply: 'Použít',
        cancel: 'Zrušit',
      },
      a11y: {
        rangeSegmentedControl: 'Výběr časového rozsahu',
        drinkTypeChipRow: 'Filtr typu drinku',
        sessionTypeToggle: 'Zobrazit jen živé relace',
        comparisonToggle: 'Režim porovnání',
        previousPeriod: 'Předchozí období',
        nextPeriod: 'Další období',
        rangeLabel: 'Vybraný rozsah dat, dvojitým klepnutím změníte',
        jumpToLatest: 'Přejít na nejnovější období',
        revertToPreset: 'Vrátit se na předchozí rozsah',
      },
    },
  },
  badgesScreen: {
    title: 'Odznaky',
    badgesTitle: 'Odznaky',
    empty:
      'Zaznamenejte svou první alkoholovou relaci, abyste začali získávat odznaky a sledovat svou sérii dnů bez alkoholu.',
    dayUnit: ({count}: BadgesDayCountParams) => (count === 1 ? 'den' : 'dní'),
    streak: {
      label: 'Aktuální série dnů bez alkoholu',
    },
    stats: {
      longestStreak: 'Nejdelší série',
      totalAfDays: 'Dny bez alkoholu',
      sessions: 'Zaznamenané relace',
    },
    badges: {
      firstSession: {
        title: 'První relace',
        description: 'Zaznamenejte svou první alkoholovou relaci.',
      },
      dryDay: {
        title: 'První den bez alkoholu',
        description: 'Zaznamenejte svůj první den bez alkoholu.',
      },
      dryWeek: {
        title: 'Týden bez alkoholu',
        description: 'Dosáhněte série 7 dní bez alkoholu.',
      },
      dryFortnight: {
        title: 'Dva týdny bez alkoholu',
        description: 'Dosáhněte série 14 dní bez alkoholu.',
      },
      dryMonth: {
        title: 'Měsíc bez alkoholu',
        description: 'Dosáhněte série 30 dní bez alkoholu.',
      },
      afDays10: {
        title: '10 dní bez alkoholu',
        description: 'Nasbírejte 10 dní bez alkoholu.',
      },
      afDays50: {
        title: '50 dní bez alkoholu',
        description: 'Nasbírejte 50 dní bez alkoholu.',
      },
      sessions25: {
        title: 'Pečlivé zaznamenávání',
        description: 'Zaznamenejte 25 alkoholových relací.',
      },
    },
  },
  dayOverviewScreen: {
    enterEditMode: 'Režim úprav',
    exitEditMode: 'Ukončit úpravy',
    noDrinkingSessions: 'Žádné alkoholové relace',
    addSessionExplained: 'Přidat relaci (plovoucí tlačítko)',
    selectSessionDate: 'Vyberte datum nové relace',
    sessionWindow: ({sessionId}: SessionWindowIdParams) =>
      `Alkoholová relace: ${sessionId}`,
    ongoing: 'Probíhá',
    loadingDate: 'Načítám datum…',
    error: {
      open: 'Nepodařilo se otevřít novou relaci. Zkuste to prosím znovu.',
    },
  },
  homeScreen: {
    startingSession: 'Spouštím novou relaci…',
    welcomeToKiroku: 'Vítejte v Kiroku!',
    startNewSessionByClickingPlus:
      'Spusťte novou relaci kliknutím na tlačítko plus v dolní části obrazovky',
    offlineNoData: {
      title: 'Jste offline',
      message:
        'Nepodařilo se nám načíst vaše relace. Připojte se a zobrazí se tady.',
    },
    banners: {
      inSession: {
        label: 'Probíhá relace',
        body: 'Klepnutím se vrátíte do relace',
        resume: 'Pokračovat',
        a11y: 'Probíhá relace. Klepnutím se do ní vrátíte.',
      },
      lastSession: {
        label: 'Poslední relace',
        summary: ({when, units}: LastSessionSummaryParams) =>
          `${when} · ${units} jednotek`,
        a11y: ({when, units}: LastSessionSummaryParams) =>
          `Zobrazit poslední relaci, ${when}, ${units} jednotek`,
        today: 'Dnes',
        yesterday: 'Včera',
        daysAgo: ({count}: RelativeTimeAgoParams) => `před ${count} dny`,
        monthsAgo: ({count}: RelativeTimeAgoParams) => `před ${count} měsíci`,
        yearsAgo: ({count}: RelativeTimeAgoParams) => `před ${count} lety`,
      },
    },
    stats: {
      thisMonth: 'Tento měsíc',
      noChange: 'Beze změny',
      units: 'Jednotky',
      sessions: 'Relace',
      alcoholFree: 'Bez alkoholu',
      statistics: 'Statistiky',
      viewStatistics: 'Zobrazit statistiky',
      vsLastMonth: 'vs minulý měsíc',
      monthToDate: 'zatím',
      unitsByWeek: 'Jednotky podle týdne',
      unitsPerWeekA11y: 'Zkonzumované jednotky za týden v tomto měsíci',
    },
  },
  sessionsCalendar: {
    dayOverviewButton: 'Přehled dne',
    jumpToCurrentMonth: 'Přejít na aktuální měsíc',
  },
  liveSessionScreen: {
    saving: 'Ukládám vaši relaci…',
    synchronizing: 'Synchronizuji data…',
    loading: 'Načítám vaši relaci…',
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
      `${discardWord} tuto relaci…`,
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
  testTools: {
    title: 'Testovací nástroje',
    intro: 'Vývojářský panel pro úpravy za běhu a ladění.',
    placeholderNotice:
      'Toto je zástupný panel. Skutečné přepínače (feature flagy, přepsání prostředí, vynucené stavy sítě) sem postupně přibudou.',
    simulatePlus: 'Simulovat Plus',
    simulatePlusDescription:
      'Považovat tento účet za podporovatele Kiroku Plus, aby se uzamčené funkce odemkly.',
    featureOverridesTitle: 'Přepsání prémiových funkcí',
    override: {
      auto: 'Auto',
      locked: 'Zamčeno',
      unlocked: 'Odemčeno',
    },
    resetOverrides: 'Resetovat přepsání',
    environmentLabel: 'Prostředí',
    howToOpen:
      'Otevřete přes ⌘D → Open Test Preferences nebo čtyřprstovým ťuknutím kdekoli v aplikaci.',
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
    private: 'Soukromé',
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
  login: {
    hero: {
      header: 'Mějte přehled o svých alkoholových dobrodružstvích',
      body: 'Vítejte v Kiroku, kde můžete sledovat, monitorovat a sdílet svou konzumaci alkoholu',
    },
    email: 'E-mail',
    existingAccount: 'Už máte účet?',
    noAccount: 'Ještě nemáte účet?',
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
    changingPassword: 'Měním vaše heslo…',
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
  pickUsernameScreen: {
    heading: 'Zvolte si uživatelské jméno',
    explainer: 'Vyberte si uživatelské jméno. Pod ním vás uvidí ostatní.',
    saving: 'Ukládám…',
    error: {
      generic:
        'Uživatelské jméno se nepodařilo uložit. Zkuste to prosím znovu.',
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
    loggingIn: 'Přihlašuji…',
  },
  signUpScreen: {
    signingIn: 'Přihlašuji…',
    signingYouIn: 'Přihlašuji vás…',
  },
  forgotPasswordScreen: {
    title: 'Zapomenuté heslo',
    prompt:
      'Pošleme vám instrukce, jak resetovat heslo, na tuto e-mailovou adresu:',
    sending: 'Odesílám e-mail…',
    submit: 'Resetovat heslo',
    enterEmail: 'Zadejte sem svůj e-mail',
    success: ({email}: ForgotPasswordSuccessParams) =>
      `E-mail s pokyny pro reset hesla byl odeslán na adresu ${email}. Nevidíte ho? Podívejte se do složky spamu.`,
    error: {
      generic: 'Při pokusu o reset hesla došlo k chybě.',
    },
  },
  connectedAccounts: {
    title: 'Propojené účty',
    subtitle:
      'Vyberte si, jak se chcete přihlašovat. Můžete propojit více způsobů. Všechny vás přihlásí ke stejnému účtu.',
    providers: {
      password: 'E-mail a heslo',
      apple: 'Apple',
      google: 'Google',
    },
    status: {
      signedInWith: 'Aktuálně přihlášeni tímto způsobem',
      connected: 'Propojeno',
      notConnected: 'Nepropojeno',
    },
    actions: {
      connect: 'Propojit',
      disconnect: 'Odpojit',
      cancel: 'Zrušit',
    },
    unlinkConfirm: {
      title: ({provider}: {provider: string}) => `Odpojit ${provider}?`,
      prompt: ({remaining}: {remaining: string}) =>
        `Od této chvíle se budete moci přihlásit pouze pomocí: ${remaining}.`,
      confirm: 'Odpojit',
    },
    reauth: {
      title: 'Ověřte se',
      passwordPrompt:
        'Z bezpečnostních důvodů prosím znovu zadejte své heslo, než provedeme tuto změnu.',
      oauthPrompt: ({provider}: {provider: string}) =>
        `Z bezpečnostních důvodů se prosím znovu přihlaste pomocí ${provider}, než provedeme tuto změnu.`,
      submit: 'Potvrdit',
      reauthWith: ({provider}: {provider: string}) =>
        `Pokračovat pomocí ${provider}`,
      error: 'Nepodařilo se ověřit vaši identitu. Zkuste to prosím znovu.',
    },
    privateRelay:
      'Apple skrývá vaši skutečnou e-mailovou adresu pomocí přeposílací adresy. Pokud Apple odpojíte a později znovu propojíte, přeposílací adresa bude jiná.',
    success: {
      connected: ({provider}: {provider: string}) =>
        `${provider} byl propojen.`,
      disconnected: ({provider}: {provider: string}) =>
        `${provider} byl odpojen.`,
    },
    error: {
      generic:
        'Propojené účty se nepodařilo aktualizovat. Zkuste to prosím znovu.',
    },
  },
  oauthLinkModal: {
    appleTitle: 'Propojit účet Apple',
    googleTitle: 'Propojit účet Google',
    body: ({email}: ForgotPasswordSuccessParams) =>
      `Účet s adresou ${email} již existuje. Zadejte heslo pro propojení.`,
    appleSubmit: 'Propojit účet Apple',
    googleSubmit: 'Propojit účet Google',
    resetEmailSent: ({email}: ForgotPasswordSuccessParams) =>
      `Odkaz pro reset hesla byl odeslán na adresu ${email}. Zkontrolujte si schránku i složku spamu, pokud ho nevidíte.`,
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
    loading: 'Načítám data…',
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
        title: 'Nesprávný e-mail nebo heslo',
        message:
          'Zkontrolujte e-mail a heslo. Pokud jste se zaregistrovali pomocí Apple nebo Google, přihlaste se tímto způsobem.',
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
      accountExistsWithDifferentCredential: {
        title: 'Účet již existuje',
        message:
          'Účet s touto e-mailovou adresou již existuje. Přihlaste se prosím metodou, kterou jste použili při jeho vytvoření.',
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
      accountCreationLimitExceeded: {
        title: 'Překročen limit pro vytváření účtů',
        message:
          'Překročili jste limit pro vytváření účtů. Zkuste to znovu později.',
      },
      signOutFailed: {
        title: 'Odhlášení se nezdařilo',
        message: 'Při odhlašování nastal problém. Zkuste to prosím znovu.',
      },
      userIsNull: {
        title: 'Uživatel nenalezen',
        message: 'Nepodařilo se identifikovat váš účet. Restartujte aplikaci.',
      },
      credentialAlreadyInUse: {
        title: 'Již propojeno',
        message:
          'Tento účet je již propojen s jiným účtem Kiroku. Odhlaste se a přihlaste se prosím tím druhým účtem.',
      },
      noSuchProvider: {
        title: 'Není propojeno',
        message: 'Tento způsob přihlášení nemáte k účtu připojen.',
      },
      lastProvider: {
        title: 'Nelze odpojit',
        message:
          'Nelze odpojit poslední způsob přihlášení, jinak byste ztratili přístup k účtu. Nejprve přidejte jiný způsob.',
      },
    },
    database: {
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
      couldNotBlockUser: {
        title: 'Nepodařilo se zablokovat uživatele',
        message:
          'Při blokování tohoto uživatele došlo k problému. Zkuste to prosím znovu.',
      },
      couldNotReportUser: {
        title: 'Nepodařilo se nahlásit uživatele',
        message:
          'Při nahlašování uživatele došlo k problému. Zkuste to prosím znovu.',
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
