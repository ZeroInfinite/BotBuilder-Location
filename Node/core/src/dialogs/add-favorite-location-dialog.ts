import { IDialogResult, Library, Session } from 'botbuilder';
import * as common from '../common';
import { Strings } from '../consts';
import { FavoriteLocation } from '../favorite-location';
import { FavoritesManager } from '../services/favorites-manager';
import * as confirmDialog from './confirm-dialog';

export function register(library: Library): void {
    confirmDialog.register(library);
    library.dialog('add-favorite-location-dialog', createDialog());
    library.dialog('name-favorite-location-dialog', createNameFavoriteLocationDialog());
}

function createDialog() {
    return [
        // Ask the user whether they want to add the location to their favorites, if applicable
        (session: Session, args: any) => {
            // check two cases:
            // no capacity to add to favorites in the first place!
            // OR the location is already marked as favorite
            const favoritesManager = new  FavoritesManager(session.userData);
            if (favoritesManager.maxCapacityReached() || favoritesManager.isFavorite(args.place)) {
                session.endDialogWithResult({ response: {} });
            }
            else {
                session.dialogData.place = args.place;           
                var addToFavoritesAsk = session.gettext(Strings.AddToFavoritesAsk)
                session.beginDialog('confirm-dialog', { confirmationPrompt: addToFavoritesAsk });
            }
        },
        // If the user confirmed, ask them to enter a name for the new favorite location
        // Otherwise, we are done
        (session: Session, results: IDialogResult<any>, next: (results?: IDialogResult<any>) => void) => {
            // User does want to add a new favorite location
            if (results.response && results.response.confirmed) {
                session.beginDialog('name-favorite-location-dialog', { place: session.dialogData.place });
            }
            else {
                // User does NOT want to add a new favorite location
                next(results);
            }
        }
    ]
}

function createNameFavoriteLocationDialog() {
    return common.createBaseDialog()
        .onBegin(function (session, args) {
            session.dialogData.place = args.place;     
            session.send(session.gettext(Strings.EnterNewFavoriteLocationName)).sendBatch();
        }).onDefault((session) => {
            const favoriteLocation: FavoriteLocation = {
                location:  session.dialogData.place,
                name : session.message.text
            };
             const favoritesManager = new  FavoritesManager(session.userData);
            favoritesManager.add(favoriteLocation);
            session.send(session.gettext(Strings.FavoriteAddedConfirmation, favoriteLocation.name));
            session.endDialogWithResult({ response: {} });
        });
}