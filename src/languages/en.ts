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
    cancel: 'Cancel',
    dismiss: 'Dismiss',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    askMeLater: 'Ask Me Later',
    buttonConfirm: 'Got it',
    name: 'Name',
    attachment: 'Attachment',
    to: 'To',
    or: 'Or',
    optional: 'Optional',
    ago: 'Ago',
    new: 'New',
    search: 'Search',
    searchWithThreeDots: 'Search...',
    next: 'Next',
    previous: 'Previous',
    goBack: 'Go back',
    logIn: 'Log in',
    logInHere: 'Log in',
    signUp: 'Sign up',
    signUpHere: 'Sign up',
    create: 'Create',
    add: 'Add',
    resend: 'Resend',
    save: 'Save',
    select: 'Select',
    saveChanges: 'Save changes',
    submit: 'Submit',
    rotate: 'Rotate',
    zoom: 'Zoom',
    password: 'Password',
    magicCode: 'Magic code',
    twoFactorCode: 'Two-factor code',
    workspaces: 'Workspaces',
    chats: 'Chats',
    group: 'Group',
    profile: 'Profile',
    account: 'Account',
    username: 'Username',
    referral: 'Referral',
    payments: 'Payments',
    wallet: 'Wallet',
    clear: 'Clear',
    preferences: 'Preferences',
    view: 'View',
    not: 'Not',
    unknown: 'Unknown',
    authentication: 'Authentication',
    signIn: 'Sign in',
    signInWithGoogle: 'Sign in with Google',
    signInWithApple: 'Sign in with Apple',
    signInWith: 'Sign in with',
    continue: 'Continue',
    firstName: 'First name',
    lastName: 'Last name',
    displayName: 'Display name',
    nickname: 'Nickname',
    phone: 'Phone',
    phoneNumber: 'Phone number',
    phoneNumberPlaceholder: '(xxx) xxx-xxx-xxx',
    email: 'Email',
    and: 'and',
    details: 'Details',
    privacy: 'Privacy',
    hidden: 'Hidden',
    visible: 'Visible',
    delete: 'Delete',
    discard: 'Discard',
    archived: 'archived',
    contacts: 'Contacts',
    recents: 'Recents',
    close: 'Close',
    loading: 'Loading',
    download: 'Download',
    downloading: 'Downloading',
    warning: 'Warning',
    manage: 'Manage',
    pin: 'Pin',
    unPin: 'Unpin',
    back: 'Back',
    yesIKnowWhatIAmDoing: 'Yes, I know what I am doing',
    saveAndContinue: 'Save & continue',
    settings: 'Settings',
    termsOfService: 'Terms of Service',
    kirokuTermsOfService: 'Kiroku Terms of Service',
    privacyPolicy: 'Privacy Policy',
    members: 'Members',
    invite: 'Invite',
    here: 'here',
    date: 'Date',
    dob: 'Date of birth',
    gender: 'Gender',
    weight: 'Weight',
    currentYear: 'Current year',
    currentMonth: 'Current month',
    city: 'City',
    state: 'State',
    streetAddress: 'Street address',
    stateOrProvince: 'State / Province',
    country: 'Country',
    zip: 'Zip code',
    zipPostCode: 'Zip / Postcode',
    whatThis: "What's this?",
    iAcceptThe: 'I accept the ',
    remove: 'Remove',
    admin: 'Admin',
    owner: 'Owner',
    dateFormat: 'YYYY-MM-DD',
    send: 'Send',
    great: 'Great!',
    notifications: 'Notifications',
    na: 'N/A',
    noResultsFound: 'No results found',
    recentDestinations: 'Recent destinations',
    timePrefix: "It's",
    time: 'Time',
    units: 'Units',
    drinks: 'Drinks',
    conjunctionFor: 'for',
    todayAt: 'Today at',
    tomorrowAt: 'Tomorrow at',
    yesterdayAt: 'Yesterday at',
    success: 'Success',
    copiedToClipboard: 'Copied to clipboard',
    conjunctionAt: 'at',
    genericErrorMessage:
      'Oops... something went wrong and your request could not be completed. Please try again later.',
    error: {
      error: 'Error',
      unknown: 'Unknown error',
      invalidAmount: 'Invalid amount',
      acceptTerms: 'You must accept the Terms of Service to continue',
      fieldRequired: 'This field is required.',
      requestModified: 'This request is being modified by another member.',
      characterLimit: ({limit}: CharacterLimitParams) =>
        `Exceeds the maximum length of ${limit} characters`,
      characterLimitExceedCounter: ({length, limit}) =>
        `Character limit exceeded (${length}/${limit})`,
      dateInvalid: 'Please select a valid date',
      invalidDateShouldBeFuture: 'Please choose today or a future date.',
      invalidTimeShouldBeFuture:
        'Please choose a time at least one minute ahead.',
      invalidCharacter: 'Invalid character',
      enterAmount: 'Enter an amount',
      enterDate: 'Enter a date',
      userNull: 'We could not find your user. Please log in again.',
      notFound: 'Not found',
      reauthenticationFailed: 'Reauthentication failed',
      sessionIdCreation: 'Failed to create a new session ID',
    },
    comma: 'comma',
    semicolon: 'semicolon',
    please: 'Please',
    contactUs: 'contact us',
    fixTheErrors: 'fix the errors',
    inTheFormBeforeContinuing: 'in the form before continuing',
    confirm: 'Confirm',
    reset: 'Reset',
    done: 'Done',
    more: 'More',
    join: 'Join',
    leave: 'Leave',
    decline: 'Decline',
    cantFindAddress: "Can't find your address? ",
    enterManually: 'Enter it manually',
    message: 'Message ',
    leaveRoom: 'Leave room',
    leaveThread: 'Leave thread',
    you: 'You',
    youAfterPreposition: 'you',
    your: 'your',
    youAppearToBeOffline: 'You appear to be offline.',
    thisFeatureRequiresInternet:
      'This feature requires an active internet connection to be used.',
    areYouSure: 'Are you sure?',
    verify: 'Verify',
    yesContinue: 'Yes, continue',
    websiteExample: 'e.g. https://www.kiroku.com',
    description: 'Description',
    with: 'with',
    shareCode: 'Share code',
    share: 'Share',
    per: 'per',
    mi: 'mile',
    km: 'kilometer',
    copied: 'Copied!',
    someone: 'Someone',
    total: 'Total',
    edit: 'Edit',
    letsDoThis: `Let's do this!`,
    letsStart: `Let's start`,
    showMore: 'Show more',
    category: 'Category',
    tag: 'Tag',
    receipt: 'Receipt',
    replace: 'Replace',
    distance: 'Distance',
    mile: 'mile',
    miles: 'miles',
    kilometer: 'kilometer',
    kilometers: 'kilometers',
    recent: 'Recent',
    all: 'All',
    am: 'AM',
    pm: 'PM',
    tbd: 'TBD',
    card: 'Card',
    whyDoWeAskForThis: 'Why do we ask for this?',
    required: 'Required',
    showing: 'Showing',
    of: 'of',
    default: 'Default',
    update: 'Update',
    member: 'Member',
    role: 'Role',
    note: 'Note',
    blackout: 'Blackout',
    timezone: 'Timezone',
  },
  calendar: {
    monthNames: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ],
    monthNamesShort: [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ],
    dayNames: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today',
  },
  textInput: {
    accessibilityLabel: 'Text input',
    resetSearch: 'Reset search',
  },
  bottomTabBar: {
    home: 'Home',
    friends: 'Friends',
    profile: 'Profile',
    settings: 'Settings',
    achievements: 'Badges',
    statistics: 'Statistics',
    menu: 'Menu',
  },
  drinks: {
    // The keys are in snake_case to match the API
    smallBeer: 'Small Beer',
    beer: 'Beer',
    wine: 'Wine',
    weakShot: 'Weak Shot',
    strongShot: 'Strong Shot',
    cocktail: 'Cocktail',
    other: 'Other',
  },
  charts: {
    target: 'Target',
    heatmap: 'Heatmap',
    trend: 'Trend',
    legend: 'Legend',
    noData: 'No data available',
    units: 'units',
  },
  units: {
    yellow: 'Yellow',
    orange: 'Orange',
  },
  timePeriods: {
    never: 'Never',
    thirtyMinutes: '30 minutes',
    oneHour: '1 hour',
    afterToday: 'Today',
    afterWeek: 'A week',
    custom: 'Custom',
    untilTomorrow: 'Until tomorrow',
    untilTime: ({time}: UntilTimeParams) => `Until ${time}`,
    fullSingle: {
      second: 'second',
      minute: 'minute',
      hour: 'hour',
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    },
    fullPlural: {
      second: 'seconds',
      minute: 'minutes',
      hour: 'hours',
      day: 'days',
      week: 'weeks',
      month: 'months',
      year: 'years',
    },
    abbreviated: {
      second: 's',
      minute: 'm',
      hour: 'h',
      day: 'd',
      week: 'w',
      month: 'M',
      year: 'Y',
    },
  },
  session: {
    people: {
      selectAll: 'Select all',
    },
    offlineMessageRetry:
      "Looks like you're offline. Please check your connection and try again.",
  },
  agreeToTerms: {
    title: "We've updated our terms of service",
    description:
      'We encourage you to read the updated terms of service and privacy policy in full.',
    iHaveRead:
      'I have read and agree to the terms of service and privacy policy',
    mustAgree:
      'You must agree to the terms of service and privacy policy before continuing.',
  },
  location: {
    useCurrent: 'Use current location',
    notFound:
      'We were unable to find your location, please try again or enter an address manually.',
    permissionDenied:
      'It looks like you have denied permission to your location.',
    please: 'Please',
    allowPermission: 'allow location permission in settings',
    tryAgain: 'and then try again.',
  },
  imageUpload: {
    uploadSuccess: 'Image uploaded successfully!',
    uploadingImage: 'Uploading image...',
    uploadFinished: 'Upload finished!',
    pleaseReload: 'Please reload the app to see changes.',
  },
  storage: {
    permissionDenied: 'Storage Permission Required',
    appNeedsAccess:
      'App needs access to your storage to read files. Please go to app settings and grant permission.',
    openSettings: 'Open Settings',
  },
  permissions: {
    permissionDenied: 'Permission Denied',
    youNeedToGrantPermission:
      'You need to grant permission for this functionality to work.',
    camera: {
      title: 'Camera Access Required',
      message: 'This app needs access to your camera for taking pictures.',
    },
    read_photos: {
      title: 'Access to Photos Required',
      message: 'This app requires access to your photos to function properly.',
    },
    write_photos: {
      title: 'Write Photos Access Required',
      message: 'This app needs access to write photos to your device.',
    },
    notifications: {
      title: 'Notification Access Required',
      message: 'This app needs access to send notifications to your device.',
    },
  },
  personalDetails: {
    error: {
      hasInvalidCharacter: 'Invalid character',
      containsReservedWord: 'This name contains a reserved word.',
      characterLimitExceedCounter: ({length, limit}) =>
        `Character limit exceeded (${length}/${limit})`,
      characterLimit: ({limit}: CharacterLimitParams) =>
        `Exceeds the maximum length of ${limit} characters`,
      requiredFirstName: 'First name cannot be empty',
      requiredLastName: 'Last name cannot be empty',
      requiredDisplayName: 'Nickname cannot be empty',
    },
  },
  searchResult: {
    self: 'You',
    friend: 'Already a friend',
    sent: 'Awaiting a response',
    accept: 'Accept friend request',
    add: 'Send a request',
  },
  socialScreen: {
    title: 'Friends',
    friendList: 'Friend List',
    friendSearch: 'Friend Search',
    friendRequests: 'Friend Requests',
    noFriendsYet: 'You do not have any friends yet',
    addThemHere: 'Add them here',
  },
  friendsFriendsScreen: {
    title: 'Find Friends of Friends',
    seeProfile: 'See profile',
    searchUsersFriends: "Search for the user's friends",
    commonFriends: 'Common Friends',
    otherFriends: 'Other Friends',
    noFriendsFound: 'No friends found.',
    trySearching: 'Try searching for other users.',
    hasNoFriends: 'This user has not added any friends yet.',
  },
  friendSearchScreen: {
    title: 'Search For New Friends',
    noUsersFound: 'There are no users with this nickname.',
    searchWindow: "Search for a user's nickname",
  },
  friendRequestScreen: {
    requestsReceived: ({requestsCount}: FriendRequestsCountParams) =>
      `Requests Received (${requestsCount})`,
    requestsSent: ({requestsCount}: FriendRequestsCountParams) =>
      `Requests Sent (${requestsCount})`,
    lookingForNewFriends: 'Looking for new friends?',
    trySearchingHere: 'Try searching here',
    accept: 'Accept',
    remove: 'Remove',
    error: {
      userDoesNotExist: "This user doesn't exist.",
      couldNotAccept: 'Could not accept the friend request.',
      couldNotRemove: 'Could not remove the friend request.',
    },
  },
  friendListScreen: {
    searchYourFriendList: 'Search your friend list',
    userList: 'The list of your friends',
  },
  notFoundScreen: {
    title: 'Not Found',
  },
  preferencesScreen: {
    title: 'Preferences',
    generalSection: {
      title: 'General',
      firstDayOfWeek: 'First day of the week',
      theme: "App's theme",
    },
    drinksAndUnitsSection: {
      title: 'Drinks and Units',
      description:
        "Set how many units each drink is worth and when the session's color changes",
      drinksToUnits: 'Drinks to units',
      unitsToColors: 'Units to colors',
    },
    save: 'Save preferences',
    saving: 'Saving your preferences...',
    unsavedChanges:
      'You have unsaved changes. Are you sure you want to go back?',
    error: {
      save: "We couldn't save your preferences. Please try again.",
    },
  },
  unitsToColorsScreen: {
    title: 'Units to Colors',
    description:
      'Set cutoff points where session colors change; each is the maximum value up to which the session retains that color',
  },
  drinksToUnitsScreen: {
    title: 'Drinks to Units',
    description: 'Choose how many units each drink is worth',
  },
  languageScreen: {
    language: 'Language',
    languages: {
      en: {
        label: 'English',
      },
      cs_cz: {
        label: 'Czech',
      },
    },
  },
  themeScreen: {
    theme: 'Theme',
    themes: {
      dark: {
        label: 'Dark',
      },
      light: {
        label: 'Light',
      },
      system: {
        label: 'System',
      },
    },
    loading: 'Setting your theme. Please wait...',
    chooseThemeBelowOrSync:
      'Choose a theme below, or sync with your device settings.',
  },
  adminScreen: {
    title: 'Admin Tools',
    generalSection: 'General',
    seeFeedback: 'See feedback',
    seeBugReports: 'See bug reports',
    feedback: 'Feedback',
    bugReports: 'Bug reports',
  },
  sessionSummaryScreen: {
    title: 'Session Summary',
    generalSection: {
      title: 'General',
      sessionColor: 'Session color',
      units: 'Units',
      date: 'Date',
      type: 'Session type',
      startTime: 'Start time',
      lastDrinkAdded: 'Last drink added',
      endTime: 'End time',
    },
    drinksSection: {
      title: 'Drinks consumed',
    },
    otherSection: {
      title: 'Other',
    },
  },
  appShareScreen: {
    title: 'Share the App',
    sectionTitle: 'Everyone, get in here!',
    prompt:
      'Help us grow by sharing Kiroku with your friends! You do so through a link or by scanning a QR code.',
    link: 'Copy share link to clipboard',
    linkCopied: 'Share link copied to clipboard!',
    qrCode: 'Show QR Code',
    error: {
      copy: 'Error copying to clipboard. Please try again.',
    },
  },
  settingsScreen: {
    title: 'Settings',
    deleteAccount: 'Delete account',
    improvementThoughts: 'What would you like us to improve?',
    general: 'General',
    reportBug: 'Report a bug',
    giveFeedback: 'Give use a feedback',
    signOut: 'Sign out',
    shareTheApp: 'Share the app',
    adminTools: 'Admin tools',
    about: 'About',
    // signOutConfirmationText: "You'll lose any offline changes if you sign out.",
    signOutConfirmationText: 'Do you really want to sign out?',
    signingOut: 'Signing out...',
    aboutScreen: {
      viewTheCode: 'View the code',
      aboutKiroku: 'About Kiroku',
      description:
        'Kiroku is a mobile app that helps you track your alcohol consumption.',
      joinDiscord: 'Join our Discord server',
      versionLetter: 'v',
      readTheTermsAndPrivacy: {
        phrase1: 'Read the',
        phrase2: 'Terms of Service',
        phrase3: 'and',
        phrase4: 'Privacy Policy',
      },
    },
    termsOfServiceScreen: {
      loading: 'Loading Terms of Service...',
    },
    privacyPolicyScreen: {
      loading: 'Loading Privacy Policy...',
    },
    error: {},
  },
  accountScreen: {
    title: 'Profile Details',
    generalOptions: {
      title: 'General',
    },
    personalDetails: {
      title: 'Personal Details',
      subtitle:
        'These details help us provide you with the best user experience.',
    },
  },
  drinkingSession: {
    type: {
      live: 'Live',
      edit: 'Edit',
    },
    live: {
      title: 'Live',
      description: 'Track drinks as you go',
    },
    edit: {
      title: 'Edit',
      description: 'Log past sessions',
    },
    error: {
      sessionOpen: 'Failed to open a session',
      missingId: 'Missing session ID',
      missingData: 'Missing session data',
    },
  },
  startSession: {
    ongoingSessions: 'Ongoing sessions',
    startNewSession: 'Start a new session',
    newSession: 'Start a session',
    newSessionExplained: 'Start a session (Floating action)',
    sessionFrom: ({startTime}: SessionStartTimeParams) =>
      `A session from ${startTime}`,
  },
  userNameScreen: {
    headerTitle: 'User name',
    explanation:
      'Displaying your name helps your friends easily find and recognize you on your profile.',
    note: "Note: Your name will not show up elsewhere in the app just yet. We're working on it!",
    updatingUserName: 'Updating your name...',
  },
  displayNameScreen: {
    headerTitle: 'Nickname',
    isShownOnProfile: 'Your nickname is shown on your profile.',
    updatingDisplayName: 'Updating your nickname...',
  },
  tzFix: {
    introduction: {
      title: 'Important!',
      text1:
        'Hello! We want to inform you about an important update regarding how your data is handled in our app.',
      troubleWithTimezones: 'Trouble with timezones',
      text2:
        "Until now, the data we've collected hasn't included timezone information, which can affect the accuracy and consistency of your data across different regions.",
      whatDoesThisMean: 'What does this mean?',
      text3:
        "To enhance your experience and ensure all your data is accurately timestamped, we need to add a timezone to all of your existing sessions. In the following steps, we'll determine your current timezone and ask for your permission to proceed with the synchronization.",
      confirmButtonText: 'Okay, got it!',
    },
    detection: {
      title: "Let's get started!",
      isTimezoneCorrect:
        'We have automatically detected your timezone as the following. Is this correct?',
      correct: 'Yes, this is correct',
      incorrect: 'No, my usual timezone is different',
    },
    confirmation: {
      title: 'Ready to sync?',
      text: 'Do you wish to proceed with syncing all your existing data to UTC using your selected timezone?',
      cancelPrompt:
        'Failing to synchronize your data may result in inaccurate timestamps.',
      cancel: "I'll do this later",
      resume: 'I changed my mind, let’s do this!',
      syncNow: "Yeah, let's do it!",
      syncLater: 'No, not now',
      syncing: 'Syncing your data...',
      error: {
        generic: 'Error synchronizing your data',
      },
    },
    success: {
      title: 'Success!',
      text1:
        "Your data has been successfully marked with timesamps. You're all set!",
      text2:
        "In case you have any questions or need help regarding this synchronization, don't hesitate to reach out to us at kiroku.alcohol.tracker@gmail.com.",
      finishButton: 'Awesome!',
    },
  },
  timezoneScreen: {
    timezone: 'Timezone',
    isShownOnProfile: 'Your timezone is shown on your profile.',
    getLocationAutomatically: 'Automatically determine your location',
    saving: 'Saving your timezone...',
  },
  emailScreen: {
    title: 'Update Email',
    prompt: 'Your email is used to log in and receive important notifications.',
    note: "Note: Upon confirmation, we will send a verification email to your new address. You'll need to verify it to complete the change, and restart the app afterwards to see changes.",
    enterEmail: 'Your email address',
    submit: 'Update email',
    sent: 'Email updated successfully!',
    sending: 'Updating email...',
    success: ({email}: UpdateEmailSentEmailParams) =>
      `An email with instructions to change your email address has been sent to ${email}. Please reload the app after changing your email.`,
    enterPasswordToConfirm:
      'Please enter your password to confirm your identity.',
    enterPassword: 'Enter your password',
  },
  verifyEmailScreen: {
    youAreNotVerified: "Let's verify your email!",
    wouldYouLikeToVerify: ({email}: VerifyEmailScreenEmailParmas) =>
      `Would you like to verify ${email ?? 'your email'} now?`,
    illDoItLater: "I'll do it later",
    verifyEmail: 'Verify email',
    changeEmail: 'Change email',
    resendEmail: 'Resend email',
    emailSent: 'A verification email has been sent to your email address.',
    emailVerified: 'Email verified!',
    iHaveVerified: 'I have verified my email',
    oneMoreStep: 'One more step!',
    checkYourInbox:
      "Please check your inbox and verify your email.\nAfterwards, either restart the app to see changes, or press the 'I have verified my email' button below.",
    error: {
      generic: 'Error verifying your email',
      sending: 'Error sending verification email',
      dismissing: 'Error dismissing verification email',
      emailSentRecently:
        'Please wait before sending another verification email.',
      emailNotVerified: 'Your email has not been verified yet.',
    },
  },
  reportBugScreen: {
    title: 'Report a bug',
    prompt: 'What happened? Please describe the bug in detail.',
    describeBug: 'Describe the bug here',
    submit: 'Submit bug report',
    sent: 'Bug report sent!',
    sending: 'Sending a bug report...',
    error: 'There was bug reporting your bug. Please try again.',
  },
  feedbackScreen: {
    title: 'Feedback',
    prompt: 'What would you like us to improve?',
    enterFeedback: 'Enter your feedback here',
    submit: 'Submit feedback',
    sent: 'Feedback sent!',
    sending: 'Sending feedback...',
    error: 'There was an error sending your feedback. Please try again.',
  },
  deleteAccountScreen: {
    deleteAccount: 'Delete account',
    reasonForLeavingPrompt:
      'We’d hate to see you go! Would you kindly tell us why, so we can improve?',
    enterMessageHere: 'Enter message here',
    deleteAccountWarning: 'Deleting your account cannot be undone.',
    deleteAccountPermanentlyDeleteData:
      'Are you sure you want to delete your account? This will permanently delete all of your data.',
    enterPasswordToConfirm: 'Please enter your password to confirm deletion.',
    enterPassword: 'Enter your password',
    deletingAccount: 'Deleting account...',
  },
  profileScreen: {
    title: 'Profile',
    titleNotSelf: 'Friend Overview',
    noDrinkingSessions: ({isSelf}: NoDrinkingSessionsParams) =>
      `${isSelf ? 'You have not' : 'This user has not'} added any drinking sessions yet.`,
    seeAllFriends: 'See all friends',
    drinkingSessions: ({sessionsCount}: DrinkingSessionsParams) =>
      `Drinking ${Str.pluralize('Session', 'Sessions', sessionsCount)}`,
    unitsConsumed: ({unitCount}: UnitCountParams) =>
      `${Str.pluralize('Unit', 'Units', unitCount)} Consumed`,
    manageFriend: 'Manage Friend',
    unfriendPrompt: 'Do you really want to unfriend this user?',
    unfriend: 'Unfriend',
    commonFriendsLabel: ({hasCommonFriends}: CommonFriendsLabelParams) =>
      `${hasCommonFriends ? 'Common friends:' : 'Friends:'}`,
    profileImage: 'Profile Image',
  },
  statisticsScreen: {
    title: 'Statistics',
    comingSoon: 'Coming soon!',
  },
  achievementsScreen: {
    title: 'Badges',
    comingSoon: 'Coming soon!',
  },
  dayOverviewScreen: {
    enterEditMode: 'Edit Mode',
    exitEditMode: 'Exit Edit Mode',
    noDrinkingSessions: 'No drinking sessions',
    addSessionExplained: 'Add a session (Floating action)',
    sessionWindow: ({sessionId}: SessionWindowIdParams) =>
      `Drinking session: ${sessionId}`,
    ongoing: 'Ongoing',
    loadingDate: 'Loading date...',
    error: {
      open: 'Failed to open a new session. Please try again.',
    },
  },
  homeScreen: {
    startingSession: 'Starting a new session...',
    welcomeToKiroku: 'Welcome to Kiroku!',
    startNewSessionByClickingPlus:
      'Start a new session by clicking the plus button at the bottom of your screen',
    currentlyInSession: 'You are currently in a session!',
    currentlyInSessionButton:
      'A button indicating you are currently in session',
  },
  sessionsCalendar: {
    dayOverviewButton: "Day's overview",
  },
  liveSessionScreen: {
    saving: 'Saving your session...',
    synchronizing: 'Synchronizing data...',
    loading: 'Loading your session...',
    drinksConsumed: 'Drinks consumed',
    sessionFrom: 'Session from',
    sessionOn: 'Session on',
    blackout: 'Blackout',
    blackoutSwitchLabel:
      'This indicates whether your session ended in a blackout.',
    note: 'Note',
    discardSessionWarning: (discardWord: string) =>
      `Do you really want to ${discardWord} this session?`,
    unsavedChangesWarning:
      'You have unsaved changes. Are you sure you want to go back?',
    sessionDetails: 'Session details',
    discardSession: ({discardWord}: DiscardSessionParams) =>
      `${discardWord} Session`,
    saveSession: 'Save Session',
    discardingSession: ({discardWord}: DiscardSessionParams) =>
      `${discardWord} this session...`,
  },
  sessionDateScreen: {
    title: 'Session date',
    prompt: 'Please choose a date when you started this session.',
    error: {
      load: 'Failed to fetch details of this session.',
      generic: 'Failed to modify the session date.',
    },
  },
  sessionNoteScreen: {
    title: 'Session note',
    noteDescription: "This note is private and won't be shared with others.",
    error: {
      load: 'Failed to fetch details of this session.',
      generic: 'Failed to modify the session note.',
      noteTooLongError: 'Your note is too long.',
    },
  },
  sessionTimezoneScreen: {
    title: 'Session timezone',
    description:
      'Please choose the timezone you were in when you started the session.',
    note: 'Note: Each time the details of this session are viewed, its timestamps will be displayed in the selected timezone.',
    confirmPrompt: ({newTimezone}: SessionConfirmTimezoneChangeParams) =>
      `Setting the timezone to ${newTimezone} will change the date of this session. Are you sure you'd like to proceed?`,
    error: {
      generic: 'Failed to modify the session timezone.',
      errorSelectTimezone: 'Failed to select a timezone. Please try again.',
    },
  },
  maintenance: {
    heading: 'Under Maintenance',
    text: 'We are currently under maintenance for the following time frame:',
  },
  userOffline: {
    heading: 'You are offline',
    text: 'Unfortunately, Kiroku does not support offline mode yet. We appreciate your patience while we work on this feature.',
  },
  userList: {
    noFriendsFound: 'No friends found.',
    tryModifyingSearch: 'Try modifying the search text.',
  },
  userOverview: {
    inSession: 'In session',
    from: 'From',
    sober: 'Sober',
    sessionStarted: 'Session started',
    noSessionsYet: 'No sessions yet',
  },
  yearPickerScreen: {
    year: 'Year',
    selectYear: 'Please select a year',
  },
  forceUpdate: {
    heading: 'App Update Required',
    text: ({platform}: ForceUpdateTextParams) =>
      `This version of the app is now discontinued. Please update to the latest version using the link below${platform === CONST.PLATFORM.IOS ? ' or from within the TestFlight app' : ''}.`,
    link: 'Update Now',
  },
  welcomeText: {
    getStarted: 'Get started below',
    anotherLoginPageIsOpen: 'Another login page is open',
    anotherLoginPageIsOpenExplanation:
      "You've opened the login page in a separate tab. Please log in from that tab.",
    welcome: 'Welcome!',
    welcomeWithoutExclamation: 'Welcome',
    enterCredentials: 'Please enter your credentials.',
    welcomeNewAccount: ({login}: SignUpNewAccountCodeParams) =>
      `${login}!\nAre you ready to create your account?`,
    // welcomeEnterMagicCode: ({login}: WelcomeEnterMagicCodeParams) =>
    //   `Please enter the magic code sent to ${login}. It should arrive within a minute or two.`,
  },
  login: {
    hero: {
      header: 'Track your everyday alcohol adventures',
      body: 'Welcome to Kiroku, where you can track, monitor, and share your alcohol consumption',
    },
    email: 'Email',
    cannotGetAccountDetails:
      "Couldn't retrieve account details. Please signing in again.",
    initialForm: 'Initial form',
    logInForm: 'Log in form',
    signUpForm: 'Sign up form',
    existingAccount: 'Already have an account?',
    noAccount: 'Don’t have an account yet?',
    error: {},
  },
  password: {
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    reEnter: 'Re-enter your password',
    requirements:
      'Your password must contain at least 8 characters, 1 capital letter, 1 lowercase letter, and 1 number.',
    pleaseFillOutAllFields: 'Please fill out all fields',
    pleaseFillPassword: 'Please enter your password',
    forgot: 'Forgot password?',
    changingPassword: 'Changing your password...',
    error: {
      samePassword: 'This is the same password as your current one',
      incorrectPassword: 'Incorrect password. Please try again.',
      incorrectLoginOrPassword:
        'Incorrect login or password. Please try again.',
      invalidLoginOrPassword:
        'Invalid login or password. Please try again or reset your password.',
      unableToResetPassword:
        'We were unable to change your password. This is likely due to an expired password reset link in an old password reset email. We have emailed you a new link so you can try again. Check your Inbox and your Spam folder; it should arrive in just a few minutes.',
      accountLocked:
        'Your account has been locked after too many unsuccessful attempts. Please try again after 1 hour.',
      fallback: 'Something went wrong. Please try again later.',
      passwordsMustMatch: 'The passwords do not match.',
    },
  },
  baseUpdateAppModal: {
    updateApp: 'Update app',
    updatePrompt:
      'A new version of this app is available.\nWould you like to update now?',
  },
  username: {
    error: {
      usernameRequired: 'A username is required',
      usernameTooLong: 'This username is too long',
      sameUsername: 'This is the same username as your current one',
    },
  },
  emailForm: {
    email: 'Email',
    error: {
      invalidEmail: 'Invalid email address',
      sameEmail: 'This is the same email address as your current one',
      emailTooLong: 'The email address is too long',
      emailRequired: 'An email address is required',
      pleaseEnterEmail: 'Please enter an email address',
      generic: 'There was an error updating your email address.',
    },
  },
  logInScreen: {
    loggingIn: 'Logging in...',
  },
  signUpScreen: {
    signingIn: 'Signing in...',
    chooseAnotherMethod: 'Choose another sign in method',
    error: {
      generic: 'There was an error creating your account. Please try again.',
    },
  },
  forgotPasswordScreen: {
    title: 'Forgotten password',
    prompt:
      'We will send you instructions on how to reset your password using the following email:',
    sending: 'Sending you an email...',
    submit: 'Reset your password',
    enterEmail: 'Enter your email here',
    success: ({email}: ForgotPasswordSuccessParams) =>
      `An email with password reset instructions has been sent to ${email}.`,
    error: {
      generic: 'There was an error when attempting to reset your password.',
    },
  },
  passwordScreen: {
    title: 'Change your password',
    prompt: 'Please enter your current password and then your new password.',
    submit: 'Change password',
    success: 'Password changed successfully!',
    error: {
      generic: 'There was an error when attempting to change your password.',
    },
  },
  closeAccount: {
    successMessage: 'Your account has been successfully deleted.',
  },
  database: {
    loading: 'Fetching data...',
    error: {
      generic: 'Failed to reach the database',
      userDoesNotExist: 'User does not exist in the database',
      saveData: 'Failed to save your data to the database. Please try again.',
    },
  },
  genericErrorScreen: {
    title: 'Oops, something went wrong!',
    body: {
      helpTextMobile: 'Please close and reopen the app.',
      // helpTextMobile: 'Please close and reopen the app, or switch to',
      // helpTextWeb: 'web.',
      helpTextEmail: 'If the problem persists, reach out to',
    },
    refresh: 'Refresh',
  },
  errors: {
    storage: {
      objectNotFound: {
        title: 'Object Not Found',
        message:
          'The requested object could not be found. Please check the details and try again.',
      },
      unauthorized: {
        title: 'Unauthorized Access',
        message:
          'You do not have the necessary permissions to perform this action.',
      },
    },
    auth: {
      accountDeletionFailed: {
        title: 'Account Deletion Failed',
        message:
          'There was an issue deleting your account. Please try again later.',
      },
      missingEmail: {
        title: 'Missing Email',
        message: 'Please provide a valid email address to continue.',
      },
      invalidEmail: {
        title: 'Invalid Email',
        message:
          'The email address provided is not valid. Please check and try again.',
      },
      verifyEmail: {
        title: 'Email Verification Required',
        message:
          'Please verify your email address before making changes to it.',
      },
      missingPassword: {
        title: 'Missing Password',
        message:
          'A password is required to proceed. Please enter your password.',
      },
      invalidCredential: {
        title: 'Invalid Credentials',
        message:
          'The credentials provided are incorrect. Please check and try again.',
      },
      weakPassword: {
        title: 'Weak Password',
        message:
          'Your password must be at least 6 characters long. Please choose a stronger password.',
      },
      emailAlreadyInUse: {
        title: 'Email Already in Use',
        message:
          'The email address is already associated with another account.',
      },
      userNotFound: {
        title: 'User Not Found',
        message:
          'No user account matches the provided details. Please sign up or try again.',
      },
      wrongPassword: {
        title: 'Incorrect Password',
        message: 'The password entered is incorrect. Please try again.',
      },
      networkRequestFailed: {
        title: 'Offline',
        message:
          'You appear to be offline. Please check your internet connection and try again.',
      },
      requiresRecentLogin: {
        title: 'Session Expired',
        message: 'For security reasons, please log in again to proceed.',
      },
      apiKeyNotValid: {
        title: 'Configuration Error',
        message:
          'The app is not configured correctly. Please contact the developer for assistance.',
      },
      tooManyRequests: {
        title: 'Too Many Requests',
        message:
          'You have made too many requests. Please wait a while before trying again.',
      },
      signOutFailed: {
        title: 'Sign Out Failed',
        message: 'There was an issue signing you out. Please try again.',
      },
      userIsNull: {
        title: 'User Not Found',
        message:
          'Your account could not be identified. Please restart the app.',
      },
    },
    database: {
      accountCreationLimitExceeded: {
        title: 'Rate Limit Exceeded',
        message:
          'You have exceeded the rate limit for account creation. Please try again later.',
      },
      dataFetchFailed: {
        title: 'Data Fetch Failed',
        message:
          'An error occurred while fetching data. Please try again later.',
      },
      outdatedAppVersion: {
        title: 'Outdated App Version',
        message:
          'Your app version is outdated. Please update to the latest version.',
      },
      searchFailed: {
        title: 'Search Failed',
        message: 'Failed to search the database. Please try again.',
      },
      userCreationFailed: {
        title: 'User Creation Failed',
        message:
          'There was an issue creating the user account. Please try again.',
      },
    },
    homeScreen: {
      title: {
        title: 'Home Screen Error',
        message: 'Failed to load the home screen.',
      },
      noLiveSession: {
        title: 'No Live Session',
        message: "You're not currently in a session.",
      },
    },
    imageUpload: {
      fetchFailed: {
        title: 'Image Upload Failed',
        message: 'Could not fetch the image. Please try again.',
      },
      uploadFailed: {
        title: 'Image Upload Failed',
        message: 'There was an error uploading your image. Please try again.',
      },
      choiceFailed: {
        title: 'Image Choice Failed',
        message:
          'There was an error when selecting your image. Please try again.',
      },
    },
    onyx: {
      generic: {
        title: 'Database error',
        message: 'Failed to reach the local database',
      },
    },
    session: {
      discardFailed: {
        title: 'Session Discard Error',
        message: 'Failed to discard the session. Please try again.',
      },
      loadFailed: {
        title: 'Session Load Error',
        message: 'Failed to load the session. Please try again.',
      },
      saveFailed: {
        title: 'Session Save Error',
        message: 'Failed to save the session. Please try again.',
      },
      startFailed: {
        title: 'Session Start Error',
        message: 'Failed to start a new session.',
      },
    },
    user: {
      bugSubmissionFailed: {
        title: 'Bug Submission Failed',
        message: 'There was an issue submitting the bug. Please try again.',
      },
      couldNotUnfriend: {
        title: 'Could Not Unfriend',
        message:
          'There was an issue trying to unfriend this user. Please try again.',
      },
      dataFetchFailed: {
        title: 'Data Fetch Failed',
        message: 'Failed to fetch user data. Please try reloading the page.',
      },
      feedbackRemovalFailed: {
        title: 'Feedback Removal Failed',
        message: 'There was an issue removing the feedback. Please try again.',
      },
      feedbackSubmissionFailed: {
        title: 'Feedback Submission Failed',
        message:
          'There was an issue submitting the feedback. Please try again.',
      },
      friendRequestSendFailed: {
        title: 'Friend Request Failed',
        message:
          'There was an issue sending the friend request. Please try again.',
      },
      friendRequestAcceptFailed: {
        title: 'Friend Request Failed',
        message:
          'There was an issue accepting the friend request. Please try again.',
      },
      friendRequestRejectFailed: {
        title: 'Friend Request Failed',
        message:
          'There was an issue removing the friend request. Please try again.',
      },
      nicknameUpdateFailed: {
        title: 'Nickname Update Failed',
        message: 'There was an error updating your nickname. Please try again.',
      },
      statusUpdateFailed: {
        title: 'Status Update Failed',
        message: 'There was an error updating your status. Please try again.',
      },
      themeUpdateFailed: {
        title: 'Theme Update Failed',
        message: 'There was an error updating your theme. Please try again.',
      },
      timezoneUpdateFailed: {
        title: 'Timezone Update Failed',
        message: 'There was an error updating your timezone. Please try again.',
      },
      usernameUpdateFailed: {
        title: 'Username Update Failed',
        message: 'There was an error updating your username. Please try again.',
      },
    },
    generic: {
      title: 'Error',
      message: 'An error occurred.',
    },
    permissionDenied: {
      title: 'Permission Denied',
      message:
        'You do not have the necessary permissions. Contact the administrator for help.',
    },
    unknown: {
      title: 'Unknown Error',
      message: 'An unknown error occurred.',
    },
  },
} satisfies TranslationBase;
