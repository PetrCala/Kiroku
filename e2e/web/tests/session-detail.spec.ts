import {test, expect} from '../fixtures/auth';
import {HomePage} from '../pages/HomePage';
import {SessionPage} from '../pages/SessionPage';
import {trackErrors} from '../fixtures/consoleErrors';
import {
  serveNoSessionPhotos,
  serveOneSessionPhoto,
} from '../fixtures/sessionPhotos';

/**
 * The session detail page (Sessions v2 RFC §9): the activity page a saved
 * session opens into, evolved from the old summary. It shows the session's
 * name and date, a stat strip (duration, units, drinks), the photo gallery, the
 * drink breakdown read through the entries adapter, the note, and the edit
 * actions for name and visibility.
 *
 * Both specs are self-cleaning: each deletes the session it started, so the
 * shared dev account never accumulates sessions across CI runs. Photos are
 * faked at the network boundary (see `fixtures/sessionPhotos`) rather than
 * uploaded, so nothing is left in the dev bucket and the specs do not need to
 * drive an OS file dialog.
 */
test.describe('session detail page', () => {
  test('shows the name, stats and drink breakdown for a session with no photos', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    await serveNoSessionPhotos(authedPage);
    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    await session.startLiveSession();
    await session.logOneDrink();
    const loggedUnits = await session.totalUnits().innerText();
    await session.save();

    // The header carries a name. A session started in the app gets the
    // generated default ("Friday evening"), so this is never blank.
    await expect(session.summaryScreen()).toBeVisible();
    await expect(session.detailName()).not.toHaveText('');

    // The stat strip: the units match what was logged, and the drink count is
    // the one drink. Duration shows because this was a live session.
    await expect(session.detailStat('units')).toHaveText(loggedUnits);
    await expect(session.detailStat('drinks')).toHaveText('1');
    await expect(session.detailStat('duration')).toBeVisible();

    // The breakdown lists exactly the one type that was logged.
    await expect(session.detailDrinkRows()).toHaveCount(1);

    // No photos: the gallery is just the owner's add tile.
    await expect(session.addPhotoButton()).toBeVisible();

    await session.openEditFromSummary();
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });

  test('shows the gallery for a session that has a photo', async ({
    authedPage,
  }) => {
    const errors = trackErrors(authedPage);
    const homePage = new HomePage(authedPage);
    const session = new SessionPage(authedPage);

    // The session id is only known once the session starts, so the fixture
    // reads it lazily: it attaches the photo record to the session the SAVE
    // echoes back, by which point the id below is set.
    let sessionId: string | undefined;
    await serveOneSessionPhoto(authedPage, () => sessionId);

    await homePage.goto();
    await expect(homePage.screen()).toBeVisible();

    await session.startLiveSession();
    sessionId = session.currentSessionId();
    await session.logOneDrink();
    await session.save();
    await expect(session.summaryScreen()).toBeVisible();

    // A tile only exists for a photo that has BOTH halves: the record, read off
    // the session, and the signed url, fetched from
    // `GET /v1/images/session-photos`. So the tile being there is the proof the
    // gallery is wired end to end, and its label says it is the only one.
    const gallery = authedPage.getByTestId('Session Summary Screen');
    const photoTile = gallery.getByRole('button', {name: 'Photo 1 of 1'});
    await expect(photoTile).toBeVisible();

    // And it paints the bytes that were served. react-native-web draws a loaded
    // `Image` as a background-image and emits an `<img>` alongside it for the
    // browser's own image affordances, so that element existing INSIDE the tile
    // means the served PNG decoded rather than the tile merely being laid out.
    await expect(photoTile.locator('img')).toHaveAttribute(
      'src',
      /^data:image\/png/,
    );

    await session.openEditFromSummary();
    await session.discardAndConfirm();
    await expect(homePage.screen()).toBeVisible();

    expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual(
      [],
    );
  });
});
