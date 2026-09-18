import React, {useRef, useState} from 'react';
import {View} from 'react-native';
import Button from '@components/Button';
import Icon from '@components/Icon';
import * as KirokuIcons from '@components/Icon/KirokuIcons';
import type {PopoverMenuItem} from '@components/PopoverMenu';
import PopoverMenu from '@components/PopoverMenu';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import {findDrinkNameTranslationKey} from '@libs/DataHandling';
import DateUtils from '@libs/DateUtils';
import DrinkData from '@libs/DrinkData';
import {
  getEntryServing,
  getSessionEntries,
  hasCustomServing,
} from '@libs/SessionEntries';
import type {SessionEntryWithId} from '@libs/SessionEntries';
import * as DS from '@userActions/DrinkingSession';
import CONST from '@src/CONST';
import type {TranslationPaths} from '@src/languages/types';
import type {DrinkingSession} from '@src/types/onyx';
import EditEntryModal from './EditEntryModal';

type SessionTimelineProps = {
  /** The session whose entries to list */
  session: DrinkingSession;
};

/** The icon registered for a drink type, if any. */
function iconFor(key: SessionEntryWithId['key']) {
  return DrinkData.find(drink => drink.key === key)?.icon;
}

/**
 * The translation key naming where an entry was logged, or `null` for the
 * ordinary phone case. A drink logged on the watch or from the lock screen is
 * worth pointing out; one logged in the app the user is holding is not.
 */
function sourceLabelKey(
  source: SessionEntryWithId['source'],
): TranslationPaths | null {
  switch (source) {
    case CONST.SESSION.ENTRY_SOURCE.WATCH:
      return 'liveSessionScreen.source.watch';
    case CONST.SESSION.ENTRY_SOURCE.LIVE_ACTIVITY:
      return 'liveSessionScreen.source.liveActivity';
    case CONST.SESSION.ENTRY_SOURCE.WEB:
      return 'liveSessionScreen.source.web';
    case CONST.SESSION.ENTRY_SOURCE.PHONE:
      // The unremarkable case: the user logged it in the app they are holding.
      return null;
    default:
      return null;
  }
}

/**
 * Every drink in the session, in the order it happened, each one a row the
 * user can edit or delete.
 *
 * This is what entries buy over `drinks[timestamp][drinkKey]` buckets: a
 * bucket is a count with no identity, so the old UI could only show "4 beers"
 * and let you take one off the end. Here each drink has its own time, its own
 * serving, its own source and its own id, so a row can name the drink it is
 * about and a delete can name the drink it removes (RFC §4.3, decision 1).
 */
function SessionTimeline({session}: SessionTimelineProps) {
  const styles = useThemeStyles();
  const theme = useTheme();
  const {translate} = useLocalize();
  const anchorRef = useRef<View>(null);

  const [menuFor, setMenuFor] = useState<SessionEntryWithId | null>(null);
  const [editing, setEditing] = useState<SessionEntryWithId | null>(null);

  const entries = getSessionEntries(session);
  const timezone = session.timezone ?? CONST.DEFAULT_TIME_ZONE.selected;

  const menuItems: PopoverMenuItem[] = [
    {
      text: translate('liveSessionScreen.editDrink'),
      icon: KirokuIcons.Pencil,
      onSelected: () => {
        setEditing(menuFor);
        setMenuFor(null);
      },
    },
    {
      text: translate('liveSessionScreen.deleteDrink'),
      icon: KirokuIcons.Delete,
      onSelected: () => {
        if (menuFor) {
          DS.removeSessionEntry(session.id, menuFor.id);
        }
        setMenuFor(null);
      },
    },
  ];

  return (
    <View style={[styles.w100, styles.pb1]} ref={anchorRef}>
      <View
        style={[
          styles.drinkTypesViewTab,
          styles.borderTop,
          styles.borderColorTheme,
        ]}>
        <Text style={styles.headerText}>
          {translate('liveSessionScreen.timeline')}
        </Text>
      </View>
      {entries.length === 0 ? (
        <Text
          testID="session-timeline-empty"
          style={[
            styles.textLabelSupporting,
            styles.textAlignCenter,
            styles.ph4,
            styles.pv2,
          ]}>
          {translate('liveSessionScreen.timelineEmpty')}
        </Text>
      ) : (
        entries.map(entry => {
          const drinkName = translate(findDrinkNameTranslationKey(entry.key));
          const time = DateUtils.getLocalizedTime(entry.ts, timezone);
          const serving = getEntryServing(entry);
          const labelKey = sourceLabelKey(entry.source);
          const icon = iconFor(entry.key);

          return (
            <View
              key={entry.id}
              testID={`timeline-entry-${entry.id}`}
              style={[
                styles.pv1,
                styles.mh3,
                styles.flexRow,
                styles.alignItemsCenter,
              ]}>
              <Text
                style={[styles.textLabelSupporting, styles.timelineEntryTime]}>
                {time}
              </Text>
              {!!icon && (
                <View style={styles.drinkTypesViewIconContainer}>
                  <Icon fill={theme.text} src={icon} height={22} width={22} />
                </View>
              )}
              <View style={[styles.flexGrow1, styles.ml1]}>
                <Text>
                  {drinkName}
                  {entry.count > 1
                    ? ` ${translate('liveSessionScreen.entryMultiplier', {
                        count: entry.count,
                      })}`
                    : ''}
                </Text>
                {/* The serving is shown only when the entry names one of its
                    own: the default is what a reader already assumes. */}
                {!!serving && hasCustomServing(entry) && (
                  <Text style={styles.textLabelSupporting}>
                    {translate('liveSessionScreen.serving', {
                      ml: serving.ml,
                      abv: Math.round(serving.abv * 1000) / 10,
                    })}
                  </Text>
                )}
              </View>
              {!!labelKey && (
                <Text
                  testID={`timeline-source-${entry.id}`}
                  style={[styles.textLabelSupporting, styles.mr1]}>
                  {translate(labelKey)}
                </Text>
              )}
              <Button
                style={[styles.bgTransparent, styles.p1]}
                onPress={() => setMenuFor(entry)}
                icon={KirokuIcons.ThreeDots}
                iconFill={theme.text}
                accessibilityLabel={translate(
                  'liveSessionScreen.entryOptions',
                  {drink: drinkName, time},
                )}
                testID={`timeline-entry-options-${entry.id}`}
              />
            </View>
          );
        })
      )}
      <PopoverMenu
        isVisible={!!menuFor}
        onClose={() => setMenuFor(null)}
        onItemSelected={item => item.onSelected?.()}
        menuItems={menuItems}
        anchorPosition={{horizontal: 0, vertical: 0}}
        anchorRef={anchorRef}
      />
      {/* Mounted fresh per entry: the modal seeds its fields from the entry
          once, so a new one has to be a new component instance rather than a
          prop change an effect has to chase. */}
      {!!editing && (
        <EditEntryModal
          key={editing.id}
          entry={editing}
          session={session}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}

export default SessionTimeline;
export {sourceLabelKey};
export type {SessionTimelineProps};
