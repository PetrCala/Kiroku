export default function () {
  if (Intl && 'ListFormat' in Intl) {
    return;
  }

  require('@formatjs/intl-listformat/polyfill-force');

  // Load locale data for every language the app ships
  require('@formatjs/intl-listformat/locale-data/en');
  require('@formatjs/intl-listformat/locale-data/cs');
}
